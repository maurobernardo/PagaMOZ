import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

# Formato E.164 moçambicano: +258 seguido de 9 dígitos (8x móvel, 2x fixo).
phone_validator = RegexValidator(r"^\+258[28]\d{8}$", "Use o formato +258XXXXXXXXX.")


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, phone, password=None, **extra):
        user = self.model(phone=phone, **extra)
        user.set_password(password)  # None -> unusable password (login por OTP)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True)
        return self.create_user(phone, password, **extra)


class User(AbstractUser):
    username = None
    phone = models.CharField("telefone", max_length=13, unique=True, validators=[phone_validator])
    email = models.EmailField(blank=True)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS: list[str] = []
    objects = UserManager()

    def __str__(self):
        return self.get_full_name() or self.phone


def _hash_code(phone: str, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


class OtpChallenge(models.Model):
    MAX_ATTEMPTS = 5
    TTL = timedelta(minutes=5)

    phone = models.CharField(max_length=13, db_index=True)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.phone} {self.created_at:%H:%M}"

    @classmethod
    def issue(cls, phone: str) -> tuple["OtpChallenge", str]:
        code = f"{secrets.randbelow(10**6):06d}"
        ch = cls.objects.create(phone=phone, code_hash=_hash_code(phone, code),
                                expires_at=timezone.now() + cls.TTL)  # fmt: skip
        return ch, code

    def verify_code(self, code: str) -> bool:
        """Conta a tentativa; só é válido se não expirou, não foi usado e não esgotou tentativas."""
        OtpChallenge.objects.filter(pk=self.pk).update(attempts=models.F("attempts") + 1)
        self.refresh_from_db()
        if self.used_at or self.expires_at < timezone.now() or self.attempts > self.MAX_ATTEMPTS:
            return False
        if not hmac.compare_digest(self.code_hash, _hash_code(self.phone, code)):
            return False
        # Só um pedido concorrente consegue "gastar" o código.
        return bool(OtpChallenge.objects.filter(pk=self.pk, used_at__isnull=True).update(used_at=timezone.now()))


class SavedObligation(models.Model):
    """Carteira de obrigações: contratos/referências que o cidadão paga com frequência."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="obligations")
    service = models.ForeignKey("catalog.Service", on_delete=models.CASCADE, related_name="+")
    label = models.CharField(max_length=60)
    fields = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["label"]
        constraints = [models.UniqueConstraint(fields=["user", "service", "label"], name="uniq_obligation")]

    def __str__(self):
        return self.label
