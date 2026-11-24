from django.conf import settings
from django.db import models


class AuditLogQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionError("Registo de auditoria é imutável.")

    def delete(self):
        raise PermissionError("Registo de auditoria é imutável.")


class AuditLog(models.Model):
    """Append-only. Bloqueado na aplicação; em Postgres reforçar com trigger/REVOKE (Fase 8)."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    institution = models.ForeignKey("institutions.Institution", null=True, on_delete=models.SET_NULL, related_name="+")
    action = models.CharField(max_length=60)
    target_type = models.CharField(max_length=60, blank=True)
    target_id = models.CharField(max_length=60, blank=True)
    data = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    objects = AuditLogQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action}"

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError("Registo de auditoria é imutável.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Registo de auditoria é imutável.")


def record(action, *, request=None, actor=None, institution=None, target=None, **data) -> AuditLog:
    if request is not None:
        actor = actor or (request.user if request.user.is_authenticated else None)
    return AuditLog.objects.create(
        action=action,
        actor=actor,
        institution=institution,
        target_type=type(target).__name__ if target is not None else "",
        target_id=str(target.pk) if target is not None else "",
        data=data,
        ip=request.META.get("REMOTE_ADDR") if request is not None else None,
    )
