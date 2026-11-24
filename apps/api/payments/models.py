import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def new_reference() -> str:
    # 10 caracteres sem ambíguos (0/O, 1/I/L): ~50 bits, não adivinhável.
    alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
    return "PMZ" + "".join(secrets.choice(alphabet) for _ in range(10))


def default_expiry():
    return timezone.now() + timedelta(minutes=settings.PAYMENT_EXPIRY_MINUTES)


class Method(models.TextChoices):
    MPESA = "mpesa", "M-Pesa"
    EMOLA = "emola", "e-Mola"
    MKESH = "mkesh", "mKesh"
    CARD = "cartao", "Cartão Visa/Mastercard"
    BANK = "referencia_bancaria", "Referência bancária"
    QR = "qr", "QR Code"


class Status(models.TextChoices):
    CREATED = "CRIADA"
    PENDING = "PENDENTE"
    CONFIRMED = "CONFIRMADA"
    SETTLED = "LIQUIDADA"
    FAILED = "FALHADA"
    EXPIRED = "EXPIRADA"
    REVERSED = "REVERTIDA"
    DISPUTED = "EM_DISPUTA"


class Transaction(models.Model):
    reference = models.CharField(max_length=16, unique=True, default=new_reference, editable=False)
    service = models.ForeignKey("catalog.Service", on_delete=models.PROTECT, related_name="transactions")
    institution = models.ForeignKey("institutions.Institution", on_delete=models.PROTECT, related_name="transactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    payer_phone = models.CharField(max_length=13, blank=True)
    payload = models.JSONField(default=dict, blank=True)  # dados do serviço (contador, NUIT…)
    description = models.CharField(max_length=200, blank=True)

    # Centavos. total = o que o cidadão paga; net = o que a instituição recebe.
    amount = models.PositiveBigIntegerField()
    commission = models.PositiveBigIntegerField()
    commission_payer = models.CharField(max_length=12)
    total = models.PositiveBigIntegerField()
    institution_net = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3, default="MZN")

    method = models.CharField(max_length=24, choices=Method.choices)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.CREATED, db_index=True)
    provider_ref = models.CharField(max_length=64, blank=True, db_index=True)
    failure_reason = models.CharField(max_length=200, blank=True)
    demo_scenario = models.CharField(max_length=20, blank=True)

    idempotency_key = models.CharField(max_length=80, unique=True, null=True, blank=True)
    request_hash = models.CharField(max_length=64, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(default=default_expiry)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    settled_at = models.DateTimeField(null=True, blank=True)
    quote = models.OneToOneField("connectors.Quote", null=True, blank=True, on_delete=models.PROTECT)
    service_request = models.ForeignKey(
        "servicerequests.ServiceRequest", null=True, blank=True, on_delete=models.PROTECT, related_name="payments"
    )
    institution_ref = models.CharField(max_length=64, blank=True)  # recibo da instituição (confirm_payment)
    institution_notified_at = models.DateTimeField(null=True, blank=True)
    settlement = models.ForeignKey(
        "settlement.SettlementBatch", null=True, blank=True, on_delete=models.PROTECT, related_name="transactions"
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(condition=models.Q(total__gte=models.F("institution_net")), name="total_gte_net"),
        ]

    def __str__(self):
        return f"{self.reference} {self.status}"


class WebhookEvent(models.Model):
    """Webhooks recebidos. Único por (provedor, event_id) -> repetição é ignorada."""

    provider = models.CharField(max_length=24)
    event_id = models.CharField(max_length=64)
    payload = models.JSONField()
    received_at = models.DateTimeField(auto_now_add=True)
    outcome = models.CharField(max_length=40, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["provider", "event_id"], name="uniq_webhook_event")]

    def __str__(self):
        return f"{self.provider}:{self.event_id}"


class DeadLetter(models.Model):
    """Entregas que esgotaram as tentativas. Revistas manualmente no backoffice."""

    created_at = models.DateTimeField(auto_now_add=True)
    kind = models.CharField(max_length=40)
    payload = models.JSONField()
    error = models.TextField()
    resolved = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.kind} {self.created_at:%Y-%m-%d %H:%M}"
