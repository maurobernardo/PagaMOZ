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


def resolve_amount(service, requested: int | None) -> int:
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
    # ponytail: "consulta" usa o valor cotado pelo conector (Fase 3); até lá aceita o valor enviado.
    if not requested or requested <= 0:
        raise PaymentError("Valor por consultar.")
    return requested


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
        record(f"payment.{new.lower()}", actor=actor, institution=txn.institution, target=txn,
               de=old, reason=reason)  # fmt: skip
    return True
