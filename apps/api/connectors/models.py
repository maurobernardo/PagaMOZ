import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone


def new_quote_id() -> str:
    return "Q" + secrets.token_urlsafe(12)


class Quote(models.Model):
    """Valor devolvido pelo conector (nível 1/2). Uso único e com validade."""

    id = models.CharField(primary_key=True, max_length=20, default=new_quote_id, editable=False)
    service = models.ForeignKey("catalog.Service", on_delete=models.CASCADE, related_name="quotes")
    payload = models.JSONField()
    amount = models.PositiveBigIntegerField()
    description = models.CharField(max_length=200)
    holder = models.CharField(max_length=80, blank=True)  # nome mascarado do titular
    external_ref = models.CharField(max_length=64, blank=True)
    details = models.JSONField(default=list, blank=True)
    items = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.id

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and self.expires_at > timezone.now()


def quote_expiry(minutes: int):
    return timezone.now() + timedelta(minutes=minutes)
