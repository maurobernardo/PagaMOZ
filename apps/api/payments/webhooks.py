from django.db import IntegrityError
from django.db import transaction as db

from .domain import InvalidTransition, transition
from .models import Status, Transaction, WebhookEvent
from .providers import get_provider


def process_webhook(method: str, body: bytes, signature: str) -> str:
    """Verifica assinatura, deduplica por event_id e aplica o resultado. Devolve o desfecho."""
    data = get_provider(method).parse_webhook(body, signature)  # InvalidSignature / ValueError
    try:
        with db.atomic():
            event = WebhookEvent.objects.create(provider=method, event_id=data["event_id"], payload=data)
    except IntegrityError:
        return "repetido"

    txn = Transaction.objects.filter(reference=data["reference"], method=method).first()
    if txn is None:
        outcome = "transaccao_desconhecida"
    elif txn.provider_ref and txn.provider_ref != data["provider_ref"]:
        outcome = "provider_ref_divergente"
    else:
        target = Status.CONFIRMED if data["status"] == "pago" else Status.FAILED
        try:
            changed = transition(txn.pk, target, reason=data.get("reason", "Recusado pelo provedor."),
                                 provider_ref=data["provider_ref"])  # fmt: skip
            outcome = "aplicado" if changed else "ja_aplicado"
        except InvalidTransition:
            # ex. falha depois de confirmada: não mexe no dinheiro, fica para reconciliação
            outcome = f"ignorado_{txn.status.lower()}"
    WebhookEvent.objects.filter(pk=event.pk).update(outcome=outcome)
    return outcome
