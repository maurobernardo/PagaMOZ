from django.core.exceptions import ValidationError
from django.db import models

from institutions.models import Commission, Institution


class Category(models.Model):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    description = models.CharField(max_length=200, blank=True)
    icon = models.CharField(max_length=40, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Service(Commission):
    class Level(models.IntegerChoices):
        LOOKUP = 1, "Consulta + pagamento em tempo real"
        REFERENCE = 2, "Referência de pagamento"
        ASSISTED = 3, "Pedido assistido"

    class Pricing(models.TextChoices):
        FIXED = "fixo", "Valor fixo"
        LOOKUP = "consulta", "Valor obtido por consulta"
        OPEN = "aberto", "Valor introduzido pelo cidadão"

    institution = models.ForeignKey(Institution, on_delete=models.PROTECT, related_name="services")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="services")
    name = models.CharField(max_length=160)
    slug = models.SlugField()
    description = models.TextField(blank=True)
    integration_level = models.PositiveSmallIntegerField(choices=Level.choices)
    pricing = models.CharField(max_length=10, choices=Pricing.choices)
    amount = models.PositiveBigIntegerField("valor fixo (centavos)", null=True, blank=True)
    min_amount = models.PositiveBigIntegerField("mínimo (centavos)", null=True, blank=True)
    max_amount = models.PositiveBigIntegerField("máximo (centavos)", null=True, blank=True)
    # Campos que o cidadão preenche: [{"name","label","type","required","pattern"}]
    fields = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category__order", "name"]
        constraints = [models.UniqueConstraint(fields=["institution", "slug"], name="uniq_service_slug")]

    def __str__(self):
        return f"{self.name} — {self.institution}"

    def clean(self):
        if self.pricing == self.Pricing.FIXED and not self.amount:
            raise ValidationError({"amount": "Serviço de valor fixo precisa de valor."})
        if self.min_amount and self.max_amount and self.min_amount > self.max_amount:
            raise ValidationError({"min_amount": "Mínimo maior que o máximo."})

    def effective_commission(self) -> dict:
        """Regra: o serviço sobrepõe-se à instituição, campo a campo."""
        inst = self.institution

        def pick(field, default):
            own = getattr(self, field)
            if own not in (None, ""):
                return own
            parent = getattr(inst, field)
            return default if parent in (None, "") else parent

        return {
            "bps": pick("commission_bps", 0),
            "fixed": pick("commission_fixed", 0),
            "payer": pick("commission_payer", Commission.Payer.INSTITUTION),
        }
