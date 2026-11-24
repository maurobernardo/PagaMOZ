import secrets

from django.conf import settings
from django.db import models


def new_code() -> str:
    alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
    return "PED" + "".join(secrets.choice(alphabet) for _ in range(10))


class RequestStatus(models.TextChoices):
    AWAITING_PAYMENT = "AGUARDA_PAGAMENTO", "A aguardar pagamento"
    SUBMITTED = "SUBMETIDO", "Submetido à instituição"
    IN_REVIEW = "EM_ANALISE", "Em análise"
    NEEDS_INFO = "PENDENTE_INFO", "Falta informação"
    APPROVED = "APROVADO", "Aprovado"
    READY = "PRONTO", "Pronto para levantamento"
    DONE = "CONCLUIDO", "Concluído"
    REJECTED = "REJEITADO", "Rejeitado"
    CANCELLED = "CANCELADO", "Cancelado"


R = RequestStatus
# Transições permitidas à instituição (o SUBMETIDO vem só do pagamento confirmado).
INSTITUTION_TRANSITIONS = {
    R.SUBMITTED: {R.IN_REVIEW, R.REJECTED},
    R.IN_REVIEW: {R.NEEDS_INFO, R.APPROVED, R.REJECTED},
    R.NEEDS_INFO: {R.IN_REVIEW, R.REJECTED},
    R.APPROVED: {R.READY, R.DONE},
    R.READY: {R.DONE},
}


class ServiceRequest(models.Model):
    code = models.CharField(max_length=16, unique=True, default=new_code, editable=False)
    service = models.ForeignKey("catalog.Service", on_delete=models.PROTECT, related_name="requests")
    institution = models.ForeignKey("institutions.Institution", on_delete=models.PROTECT, related_name="requests")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    applicant_phone = models.CharField(max_length=13, blank=True)
    form = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=R.AWAITING_PAYMENT,
                              db_index=True)  # fmt: skip
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code} {self.status}"


class RequestEvent(models.Model):
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=20, choices=RequestStatus.choices)
    note = models.CharField(max_length=500, blank=True)  # visível ao cidadão
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.request.code} {self.status}"


def attachment_path(instance, filename):
    return f"pedidos/{instance.request.code}/{secrets.token_hex(8)}"  # nunca o nome original no disco


class Attachment(models.Model):
    request = models.ForeignKey(ServiceRequest, on_delete=models.CASCADE, related_name="attachments")
    field = models.CharField(max_length=60)
    file = models.FileField(upload_to=attachment_path)
    original_name = models.CharField(max_length=200)
    content_type = models.CharField(max_length=60)
    size = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name
