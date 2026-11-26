from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models


class Commission(models.Model):
    """Comissão = percentagem (pontos base) + fixo (centavos). Herdado por Institution e Service."""

    class Payer(models.TextChoices):
        CITIZEN = "cidadao", "Cidadão"
        INSTITUTION = "instituicao", "Instituição"

    commission_bps = models.PositiveIntegerField(
        "comissão (pontos base)", null=True, blank=True, validators=[MaxValueValidator(10_000)]
    )
    commission_fixed = models.PositiveIntegerField("comissão fixa (centavos)", null=True, blank=True)
    commission_payer = models.CharField(max_length=12, choices=Payer.choices, blank=True)

    class Meta:
        abstract = True


class Institution(Commission):
    class Status(models.TextChoices):
        ONBOARDING = "onboarding", "Em adesão"
        ACTIVE = "activa", "Activa"
        SUSPENDED = "suspensa", "Suspensa"

    name = models.CharField("nome", max_length=160)
    slug = models.SlugField(unique=True)
    nuit = models.CharField("NUIT", max_length=9, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    # Conta de liquidação: o dinheiro cai aqui (ADR-001). Guardar só o necessário para exibir.
    settlement_bank = models.CharField("banco de liquidação", max_length=80, blank=True)
    settlement_account_masked = models.CharField("conta (mascarada)", max_length=32, blank=True)
    is_demo = models.BooleanField(default=True)
    # Logótipo carregado pelo super admin: WebP pequeno (até 256 px, fundo transparente mantido) em data URL.
    logo = models.TextField("logótipo", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Membership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrador"
        FINANCE = "financeiro", "Financeiro"
        OPERATOR = "operador", "Operador"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=12, choices=Role.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "institution"], name="uniq_membership")]

    def __str__(self):
        return f"{self.user} @ {self.institution} ({self.role})"
