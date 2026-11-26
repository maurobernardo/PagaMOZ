from django.conf import settings
from django.db import models


class Event(models.Model):
    """Registo único do que acontece (pesquisas, leituras de faturas, consultas). Base da inteligência."""

    kind = models.CharField(max_length=40, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["kind", "created_at"])]

    def __str__(self):
        return f"{self.kind} {self.created_at:%Y-%m-%d %H:%M}"


def log(kind: str, request=None, **data) -> None:
    """Regista um evento sem nunca partir o pedido que o originou."""
    user = getattr(request, "user", None)
    try:
        Event.objects.create(kind=kind, user=user if user and user.is_authenticated else None, data=data)
    except Exception:  # noqa: BLE001 - registar é acessório
        pass


class SplitBill(models.Model):
    """Conta dividida entre várias pessoas: cada parte é um pagamento próprio, ligado aqui."""

    code = models.CharField(max_length=12, unique=True)
    service = models.ForeignKey("catalog.Service", on_delete=models.PROTECT)
    fields = models.JSONField(default=dict)
    title = models.CharField(max_length=80)
    total = models.PositiveBigIntegerField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} · {self.title}"


class SplitShare(models.Model):
    split = models.ForeignKey(SplitBill, on_delete=models.CASCADE, related_name="shares")
    position = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=40, blank=True)
    amount = models.PositiveBigIntegerField()
    transaction = models.OneToOneField(
        "payments.Transaction", null=True, blank=True, on_delete=models.SET_NULL, related_name="split_share"
    )

    class Meta:
        ordering = ["position"]
        constraints = [models.UniqueConstraint(fields=["split", "position"], name="uniq_split_position")]

    def __str__(self):
        return f"{self.split.code} #{self.position}"
