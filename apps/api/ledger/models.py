"""Ledger de dupla entrada, append-only. Valores em centavos (int).

É um espelho contabilístico (ADR-001): regista o que o parceiro deve e a quem, não fundos detidos.
"""

from django.db import models, transaction
from django.db.models import Sum


class Account(models.TextChoices):
    PROVIDER_RECEIVABLE = "provedor_a_receber", "Fundos em trânsito no provedor"
    INSTITUTION_PAYABLE = "instituicao_a_liquidar", "A liquidar à instituição"
    PLATFORM_REVENUE = "comissao_plataforma", "Comissão da plataforma"
    PLATFORM_CASH = "plataforma_recebido", "Comissão recebida (split)"


class Immutable(models.Model):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.pk:
            raise PermissionError("Ledger é append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Ledger é append-only.")


class ImmutableQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionError("Ledger é append-only.")

    def delete(self):
        raise PermissionError("Ledger é append-only.")


class Journal(Immutable):
    created_at = models.DateTimeField(auto_now_add=True)
    event = models.CharField(max_length=40)
    # Chave natural do evento, ex. "confirm:PMZ123". Única: lançar duas vezes é impossível.
    key = models.CharField(max_length=80, unique=True)
    transaction = models.ForeignKey(
        "payments.Transaction", null=True, on_delete=models.PROTECT, related_name="journals"
    )
    objects = ImmutableQuerySet.as_manager()

    def __str__(self):
        return self.key


class Posting(Immutable):
    journal = models.ForeignKey(Journal, on_delete=models.PROTECT, related_name="postings")
    account = models.CharField(max_length=30, choices=Account.choices)
    institution = models.ForeignKey("institutions.Institution", null=True, on_delete=models.PROTECT)
    debit = models.PositiveBigIntegerField(default=0)
    credit = models.PositiveBigIntegerField(default=0)
    objects = ImmutableQuerySet.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(debit=0) & models.Q(credit__gt=0)) | (models.Q(credit=0) & models.Q(debit__gt=0)),
                name="posting_one_side",
            )
        ]

    def __str__(self):
        return f"{self.account} D{self.debit} C{self.credit}"


class Unbalanced(ValueError):
    pass


def post(event: str, key: str, lines: list[tuple], txn=None) -> Journal | None:
    """lines: [(account, institution|None, debit, credit)]. Idempotente pela `key`.

    Devolve None se a key já foi lançada (evento repetido).
    """
    lines = [ln for ln in lines if ln[2] or ln[3]]
    if not lines:
        raise Unbalanced("Lançamento vazio.")
    if any(not isinstance(v, int) or v < 0 for ln in lines for v in ln[2:]):
        raise Unbalanced("Valores têm de ser inteiros >= 0 (centavos).")
    if sum(ln[2] for ln in lines) != sum(ln[3] for ln in lines):
        raise Unbalanced(f"Débitos != créditos em {key}.")
    with transaction.atomic():
        journal, created = Journal.objects.get_or_create(key=key, defaults={"event": event, "transaction": txn})
        if not created:
            return None
        Posting.objects.bulk_create(
            Posting(journal=journal, account=a, institution=i, debit=d, credit=c) for a, i, d, c in lines
        )
    return journal


def balance(account: str, institution=None) -> int:
    """Saldo devedor (débitos - créditos)."""
    qs = Posting.objects.filter(account=account)
    if institution is not None:
        qs = qs.filter(institution=institution)
    s = qs.aggregate(d=Sum("debit"), c=Sum("credit"))
    return (s["d"] or 0) - (s["c"] or 0)


def trial_balance() -> int:
    """Soma de todos os débitos - créditos. Tem de ser sempre 0."""
    return sum(balance(a) for a in Account.values)
