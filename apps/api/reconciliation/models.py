from django.db import models


class StatementLine(models.Model):
    """Uma linha do extracto/ficheiro diário do provedor de pagamento (o que o provedor diz que recebeu)."""

    provider = models.CharField(max_length=24)
    business_date = models.DateField(db_index=True)
    provider_ref = models.CharField(max_length=64)
    reference = models.CharField(max_length=16, blank=True)  # a nossa referência, se o provedor a devolver
    amount = models.PositiveBigIntegerField()
    status = models.CharField(max_length=12)  # "pago" | "estornado"
    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["provider", "provider_ref", "business_date"],
                                               name="uniq_statement_line")]  # fmt: skip

    def __str__(self):
        return f"{self.provider} {self.provider_ref} {self.amount}"


class ReconciliationRun(models.Model):
    business_date = models.DateField(unique=True)
    ran_at = models.DateTimeField(auto_now=True)
    platform_count = models.PositiveIntegerField(default=0)
    provider_count = models.PositiveIntegerField(default=0)
    matched = models.PositiveIntegerField(default=0)
    discrepancies = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-business_date"]

    def __str__(self):
        return f"{self.business_date}: {self.discrepancies} divergências"


class Discrepancy(models.Model):
    class Kind(models.TextChoices):
        MISSING_AT_PROVIDER = "falta_no_provedor", "Confirmado na plataforma, ausente no provedor"
        MISSING_AT_PLATFORM = "falta_na_plataforma", "Recebido pelo provedor, sem transacção confirmada"
        AMOUNT = "valor_divergente", "Valor diferente"
        STATUS = "estado_divergente", "Estado diferente"

    run = models.ForeignKey(ReconciliationRun, on_delete=models.CASCADE, related_name="items")
    institution = models.ForeignKey("institutions.Institution", null=True, on_delete=models.PROTECT)
    kind = models.CharField(max_length=24, choices=Kind.choices)
    reference = models.CharField(max_length=16, blank=True)
    provider_ref = models.CharField(max_length=64, blank=True)
    platform_amount = models.BigIntegerField(null=True)
    provider_amount = models.BigIntegerField(null=True)
    detail = models.CharField(max_length=200, blank=True)
    resolved = models.BooleanField(default=False)
    resolution_note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["kind", "reference"]

    def __str__(self):
        return f"{self.kind} {self.reference or self.provider_ref}"
