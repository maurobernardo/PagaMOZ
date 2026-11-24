from django.db import models


class SettlementBatch(models.Model):
    """Lote de liquidação: o que o parceiro transferiu para a conta da instituição num dia."""

    institution = models.ForeignKey("institutions.Institution", on_delete=models.PROTECT, related_name="settlements")
    business_date = models.DateField()
    count = models.PositiveIntegerField()
    gross = models.PositiveBigIntegerField()  # total pago pelos cidadãos
    commission = models.PositiveBigIntegerField()
    net = models.PositiveBigIntegerField()  # creditado à instituição
    destination = models.CharField(max_length=120)  # banco + conta mascarada
    provider = models.CharField(max_length=40, default="SimulatedDirectSettlement")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-business_date"]
        constraints = [models.UniqueConstraint(fields=["institution", "business_date"], name="uniq_batch_day")]

    def __str__(self):
        return f"{self.institution} {self.business_date} {self.net}"
