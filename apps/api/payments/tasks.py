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
