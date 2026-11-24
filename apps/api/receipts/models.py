import hashlib
import hmac
import json
import secrets

from django.conf import settings
from django.db import models

ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def new_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(10))


def canonical(content: dict) -> bytes:
    return json.dumps(content, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sign(content: dict) -> str:
    """HMAC-SHA256 do conteúdo canónico com chave só do servidor (RECEIPT_SIGNING_KEY)."""
    return hmac.new(settings.RECEIPT_SIGNING_KEY.encode(), canonical(content), hashlib.sha256).hexdigest()


class Receipt(models.Model):
    """Comprovativo imutável. O PDF é gerado uma vez; o seu hash é o que se verifica."""

    code = models.CharField(max_length=10, unique=True, default=new_code, editable=False)
    transaction = models.OneToOneField("payments.Transaction", on_delete=models.PROTECT, related_name="receipt")
    issued_at = models.DateTimeField()
    content = models.JSONField()  # o que está impresso
    content_hash = models.CharField(max_length=64)
    signature = models.CharField(max_length=64)
    pdf = models.FileField(upload_to="comprovativos/", blank=True)
    pdf_sha256 = models.CharField(max_length=64, blank=True, db_index=True)
    is_demo = models.BooleanField(default=True)

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        if self.pk and Receipt.objects.filter(pk=self.pk, pdf_sha256__gt="").exists():
            raise PermissionError("Comprovativo emitido é imutável.")
        super().save(*args, **kwargs)

    @property
    def display_code(self) -> str:
        return f"{self.code[:5]}-{self.code[5:]}"

    def integrity_ok(self) -> bool:
        """O conteúdo guardado não foi alterado desde a emissão."""
        return (
            hmac.compare_digest(self.signature, sign(self.content))
            and self.content_hash == hashlib.sha256(canonical(self.content)).hexdigest()
        )
