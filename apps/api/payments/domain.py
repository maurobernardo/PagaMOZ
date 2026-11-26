"""Regras de domínio do pagamento. Única forma de mudar `Transaction.status`."""

import re

from django.db import transaction as db
from django.utils import timezone

from audit.models import record
from ledger.models import Account, post

from .models import Status, Transaction

S = Status
TRANSITIONS: dict[str, set[str]] = {
    S.CREATED: {S.PENDING, S.FAILED, S.EXPIRED},
    S.PENDING: {S.CONFIRMED, S.FAILED, S.EXPIRED},
    S.CONFIRMED: {S.SETTLED, S.REVERSED, S.DISPUTED},
    S.DISPUTED: {S.CONFIRMED, S.REVERSED},
    S.SETTLED: {S.DISPUTED},
    S.FAILED: set(),
    S.EXPIRED: {S.CONFIRMED},  # pagamento tardio: o dinheiro saiu do cidadão, tem de ser reconhecido
    S.REVERSED: set(),
}


class InvalidTransition(Exception):
    pass


class PaymentError(ValueError):
    """Erro de validação apresentável ao cidadão."""


# ---------- Valores e comissões ----------


def compute_commission(amount: int, bps: int, fixed: int) -> int:
    # Arredondamento half-up em inteiros; nunca float.
    return (amount * bps + 5_000) // 10_000 + fixed


def price(service, amount: int) -> dict:
    c = service.effective_commission()
    commission = compute_commission(amount, c["bps"], c["fixed"])
    if c["payer"] == "cidadao":
        total, net = amount + commission, amount
    else:
        if commission > amount:
            raise PaymentError("Valor inferior à comissão mínima.")
        total, net = amount, amount - commission
    return {"amount": amount, "commission": commission, "commission_payer": c["payer"], "total": total,
            "institution_net": net}  # fmt: skip


def variants(service) -> list[dict]:
    """Modalidades com preço próprio (ex.: passaporte normal/urgente), em connector_config.variants."""
    return list((service.connector_config or {}).get("variants", []))


def resolve_amount(service, requested: int | None, variant: str | None = None) -> int:
    if service.pricing == "fixo" and variants(service):
        chosen = next((v for v in variants(service) if v["key"] == variant), None)
        if chosen is None:
            raise PaymentError("Escolha a modalidade.")
        return chosen["amount"]
    if service.pricing == "fixo":
        return service.amount
    if service.pricing == "aberto":
        if not requested or requested <= 0:
            raise PaymentError("Indique o valor.")
        if service.min_amount and requested < service.min_amount:
            raise PaymentError("Valor abaixo do mínimo.")
        if service.max_amount and requested > service.max_amount:
            raise PaymentError("Valor acima do máximo.")
        return requested
    raise PaymentError("Este serviço exige consulta prévia do valor (quote).")


def validate_fields(service, payload: dict) -> dict:
    clean, errors = {}, {}
    for f in service.fields:
        if f["type"] == "file":
            continue  # anexos entram no pedido assistido (Fase 3)
        v = str(payload.get(f["name"], "")).strip()
        if not v:
            if f.get("required", True):
                errors[f["name"]] = "Obrigatório."
            continue
        if f.get("pattern") and not re.fullmatch(f["pattern"], v):
            errors[f["name"]] = "Formato inválido."
        if f["type"] == "select" and v not in {o["key"] for o in f.get("options", [])}:
            errors[f["name"]] = "Opção inválida."
        clean[f["name"]] = v
    if errors:
        raise PaymentError(errors)
    return clean


# ---------- Máquina de estados + ledger ----------


def _ledger(txn: Transaction, new: str, old: str):
    inst, ref = txn.institution, txn.reference
    if new == S.CONFIRMED and old != S.DISPUTED:
        post("confirm", f"confirm:{ref}", [
            (Account.PROVIDER_RECEIVABLE, None, txn.total, 0),
            (Account.INSTITUTION_PAYABLE, inst, 0, txn.institution_net),
            (Account.PLATFORM_REVENUE, None, 0, txn.total - txn.institution_net),
        ], txn)  # fmt: skip
    elif new == S.SETTLED:
        post("settle", f"settle:{ref}", [
            # O parceiro pagou o líquido à instituição e a comissão à plataforma (split).
            (Account.INSTITUTION_PAYABLE, inst, txn.institution_net, 0),
            (Account.PLATFORM_CASH, None, txn.total - txn.institution_net, 0),
            (Account.PROVIDER_RECEIVABLE, None, 0, txn.total),
        ], txn)  # fmt: skip
    elif new == S.REVERSED:
        post("reverse", f"reverse:{ref}", [
            (Account.INSTITUTION_PAYABLE, inst, txn.institution_net, 0),
            (Account.PLATFORM_REVENUE, None, txn.total - txn.institution_net, 0),
            (Account.PROVIDER_RECEIVABLE, None, 0, txn.total),
        ], txn)  # fmt: skip


def transition(txn_id: int, new: str, *, reason: str = "", provider_ref: str = "", actor=None, **extra) -> bool:
    """Aplica a transição com lock. Mesmo estado -> no-op (idempotente). Devolve True se mudou."""
    with db.atomic():
        txn = Transaction.objects.select_for_update().select_related("institution").get(pk=txn_id)
        old = txn.status
        if old == new:
            return False
        if new not in TRANSITIONS[old]:
            raise InvalidTransition(f"{txn.reference}: {old} -> {new}")
        txn.status = new
        if new == S.CONFIRMED and not txn.confirmed_at:
            txn.confirmed_at = timezone.now()
        if new == S.SETTLED:
            txn.settled_at = timezone.now()
        if new in (S.FAILED, S.REVERSED) and reason:
            txn.failure_reason = reason[:200]
        if provider_ref:
            txn.provider_ref = provider_ref
        for k, v in extra.items():
            setattr(txn, k, v)
        txn.save()
        _ledger(txn, new, old)
        if new == S.CONFIRMED and old != S.DISPUTED:
            if txn.service_request_id:
                from servicerequests.domain import mark_paid

                mark_paid(txn.service_request_id)
            from receipts import services as receipts

            from .tasks import notify_institution

            db.on_commit(lambda: notify_institution.delay(txn.pk))
            from accounts.tasks import push_payment_confirmed

            db.on_commit(lambda: push_payment_confirmed.delay(txn.pk))
            if receipts.ISSUE_ON_CONFIRM:
                db.on_commit(lambda: receipts.issue_receipt.delay(txn.pk))
        if new == S.REVERSED:
            from .tasks import reverse_at_institution

            db.on_commit(lambda: reverse_at_institution.delay(txn.pk))
        record(f"payment.{new.lower()}", actor=actor, institution=txn.institution, target=txn,
               de=old, reason=reason)  # fmt: skip
    return True


def resolve_source(service, data: dict) -> dict:
    """De onde vêm valor e dados do pagamento: pedido (nível 3), cotação (consulta) ou formulário.

    Chamar dentro de transacção: bloqueia a cotação/pedido para não serem usados duas vezes.
    """
    from connectors.models import Quote
    from servicerequests.models import RequestStatus, ServiceRequest

    if service.integration_level == 3:
        req = ServiceRequest.objects.select_for_update().filter(code=data.get("request", ""), service=service).first()
        if req is None:
            raise PaymentError("Crie primeiro o pedido (com anexos) e indique o código.")
        if req.status != RequestStatus.AWAITING_PAYMENT:
            raise PaymentError("Este pedido já não aguarda pagamento.")
        live = [S.CREATED, S.PENDING, S.CONFIRMED, S.SETTLED, S.DISPUTED]
        if req.payments.filter(status__in=live).exists():
            raise PaymentError("Já existe um pagamento em curso para este pedido.")
        return {"amount": resolve_amount(service, data.get("amount"), req.form.get("modalidade")), "payload": req.form,
                "description": service.name, "service_request": req}  # fmt: skip

    if service.pricing == "consulta" or (service.pricing == "aberto" and data.get("quote")):
        q = Quote.objects.select_for_update().filter(pk=data.get("quote", ""), service=service).first()
        if q is None or not q.is_valid:
            raise PaymentError("Consulta expirada ou inválida. Consulte o valor novamente.")
        q.used_at = timezone.now()
        q.save(update_fields=["used_at"])
        return {"amount": q.amount, "payload": q.payload, "description": q.description, "quote": q}

    fields = validate_fields(service, data["fields"])
    return {"amount": resolve_amount(service, data.get("amount"), fields.get("modalidade")), "payload": fields,
            "description": service.name}  # fmt: skip
