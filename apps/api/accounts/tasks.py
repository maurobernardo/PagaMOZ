"""Notificações push pelo serviço da Expo (https://exp.host/--/api/v2/push/send)."""

import json
import logging
import urllib.request

from celery import shared_task
from django.conf import settings

log = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _mzn(c: int) -> str:
    return f"{c / 100:,.2f}".replace(",", " ").replace(".", ",") + " MT"


def send(messages: list[dict]) -> list[dict]:
    """Envia em lote. Devolve os 'tickets' da Expo; tokens inválidos são apagados."""
    from .models import PushDevice

    if not messages or not getattr(settings, "PUSH_ENABLED", True):
        return []
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token := getattr(settings, "EXPO_ACCESS_TOKEN", ""):
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(EXPO_PUSH_URL, json.dumps(messages).encode(), headers)
    with urllib.request.urlopen(req, timeout=8) as r:  # noqa: S310 (URL fixa, https)
        tickets = json.loads(r.read()).get("data", [])
    for m, t in zip(messages, tickets, strict=False):
        if t.get("details", {}).get("error") == "DeviceNotRegistered":
            PushDevice.objects.filter(token=m["to"]).delete()
    return tickets


@shared_task(bind=True, max_retries=3, retry_backoff=True)
def push_payment_confirmed(self, txn_id: int):
    """'Pagamento confirmado' para os telemóveis de quem pagou (se tinha sessão iniciada)."""
    from payments.models import Transaction

    from .models import PushDevice

    txn = Transaction.objects.select_related("service", "institution").get(pk=txn_id)
    if not txn.user_id:
        return 0
    body = f"{txn.service.name} · {_mzn(txn.total)}"
    if (d := txn.delivery or {}).get("codigo"):
        body += f"\n{d.get('titulo', 'Código')}: {d['codigo']}"
    msgs = [
        {
            "to": dev.token,
            "title": "Pagamento confirmado",
            "body": body,
            "sound": "default",
            "data": {"url": f"pagamoz://pagamento/{txn.reference}"},
        }  # fmt: skip
        for dev in PushDevice.objects.filter(user_id=txn.user_id)
    ]
    try:
        send(msgs)
    except OSError as e:
        log.warning("push falhou: %s", e)
        raise self.retry(exc=e) from e
    return len(msgs)
