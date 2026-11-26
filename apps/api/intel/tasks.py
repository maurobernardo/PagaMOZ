from celery import shared_task

from accounts.models import PushDevice, User
from accounts.tasks import send

from .insights import bills


@shared_task
def remind_due_bills() -> int:
    """Uma vez por dia: avisa quem tem uma conta prevista para os próximos 2 dias ou Credelec a acabar."""
    msgs = []
    for user in User.objects.filter(push_devices__isnull=False).distinct():
        b = bills(user)
        lines = [
            f"{r['service_name']}: {r['typical_amount'] / 100:.0f} MT"
            for r in b["recurring"]
            if 0 <= r["days_left"] <= 2
        ]
        lines += [f"Credelec {c['key']}: ~{c['days_left']} dias de energia" for c in b["credelec"]
                  if c.get("days_left") is not None and c["days_left"] <= 3]  # fmt: skip
        if not lines:
            continue
        for dev in PushDevice.objects.filter(user=user):
            msgs.append(
                {
                    "to": dev.token,
                    "title": "Contas a vencer",
                    "body": "\n".join(lines[:3]),
                    "data": {"url": "pagamoz://contas"},
                }
            )
    send(msgs)
    return len(msgs)
