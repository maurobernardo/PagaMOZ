"""SettlementProvider: como e quando o líquido chega à instituição. Demo: directo, D+0."""

from datetime import date, datetime, time
from typing import Protocol
from zoneinfo import ZoneInfo

from celery import shared_task
from django.db import transaction as db
from django.db.models import Sum
from django.utils import timezone

from institutions.models import Institution
from payments.domain import transition
from payments.models import Status, Transaction

from .models import SettlementBatch

MAPUTO = ZoneInfo("Africa/Maputo")


class SettlementProvider(Protocol):
    def settle(self, institution: Institution, business_date: date) -> SettlementBatch | None: ...


class SimulatedDirectSettlement:
    """Finge que o parceiro transferiu hoje, para a conta da instituição, tudo o que foi confirmado até ao fecho."""

    def settle(self, institution, business_date):
        cutoff = datetime.combine(business_date, time.max, tzinfo=MAPUTO)
        with db.atomic():
            if SettlementBatch.objects.filter(institution=institution, business_date=business_date).exists():
                return None  # idempotente por dia
            txns = Transaction.objects.select_for_update().filter(
                institution=institution, status=Status.CONFIRMED, confirmed_at__lte=cutoff
            )
            agg = txns.aggregate(g=Sum("total"), n=Sum("institution_net"))
            ids = list(txns.values_list("pk", flat=True))
            if not ids:
                return None
            batch = SettlementBatch.objects.create(
                institution=institution, business_date=business_date, count=len(ids),
                gross=agg["g"], net=agg["n"], commission=agg["g"] - agg["n"],
                destination=f"{institution.settlement_bank} {institution.settlement_account_masked}".strip(),
            )  # fmt: skip
            for pk in ids:
                transition(pk, Status.SETTLED, settlement=batch)
        return batch


SETTLEMENT_PROVIDER: SettlementProvider = SimulatedDirectSettlement()


@shared_task
def run_daily_settlement(business_date: str | None = None) -> int:
    d = date.fromisoformat(business_date) if business_date else timezone.localdate()
    insts = Institution.objects.filter(transactions__status=Status.CONFIRMED).distinct()
    return sum(1 for inst in insts if SETTLEMENT_PROVIDER.settle(inst, d))
