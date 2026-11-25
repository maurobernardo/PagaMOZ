import json

from celery import shared_task
from django.utils import timezone

from .models import DeadLetter, Status, Transaction
from .providers import sign
from .webhooks import process_webhook


class DeliveryError(Exception):
    pass


@shared_task(bind=True, max_retries=5, retry_backoff=True, retry_backoff_max=600, acks_late=True)
def deliver_simulated_webhook(self, method: str, event: dict):
    """Simula o provedor a chamar o nosso webhook: assina e passa pelo mesmo caminho de verificação."""
    body = json.dumps(event).encode()
    try:
        process_webhook(method, body, sign(body))
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            DeadLetter.objects.create(kind=f"webhook:{method}", payload=event, error=repr(exc))
            return "dead-letter"
        raise self.retry(exc=exc) from exc
    return "ok"


@shared_task
def expire_stale_payments() -> int:
    from .domain import transition

    n = 0
    stale = Transaction.objects.filter(status__in=[Status.CREATED, Status.PENDING], expires_at__lt=timezone.now())
    for pk in stale.values_list("pk", flat=True):
        n += transition(pk, Status.EXPIRED, reason="Sem resposta do provedor dentro do prazo.")
    return n


@shared_task(bind=True, max_retries=8, retry_backoff=True, retry_backoff_max=1800, acks_late=True)
def notify_institution(self, txn_id: int):
    """connector.confirm_payment com retry exponencial; esgotado -> DeadLetter."""
    from connectors.base import get_connector

    txn = Transaction.objects.select_related("service", "institution").get(pk=txn_id)
    if txn.institution_notified_at:
        return "ja_notificada"
    try:
        conf = get_connector(txn.service).confirm_payment(txn)
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            DeadLetter.objects.create(kind="connector:confirm", payload={"reference": txn.reference}, error=repr(exc))
            return "dead-letter"
        raise self.retry(exc=exc) from exc
    Transaction.objects.filter(pk=txn_id).update(
        institution_ref=conf.institution_ref, institution_notified_at=conf.received_at, delivery=conf.delivery
    )
    return "ok"


@shared_task(bind=True, max_retries=8, retry_backoff=True, retry_backoff_max=1800, acks_late=True)
def reverse_at_institution(self, txn_id: int):
    from connectors.base import get_connector

    txn = Transaction.objects.select_related("service").get(pk=txn_id)
    try:
        get_connector(txn.service).reverse(txn)
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            DeadLetter.objects.create(kind="connector:reverse", payload={"reference": txn.reference}, error=repr(exc))
            return "dead-letter"
        raise self.retry(exc=exc) from exc
    return "ok"
