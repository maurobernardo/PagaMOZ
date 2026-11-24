"""Reconciliação diária: extracto do provedor vs transacções da plataforma."""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from celery import shared_task
from django.db import transaction as db
from django.utils import timezone

from payments.models import Status, Transaction

from .models import Discrepancy, ReconciliationRun, StatementLine

MAPUTO = ZoneInfo("Africa/Maputo")
PAID = [Status.CONFIRMED, Status.SETTLED, Status.DISPUTED]
K = Discrepancy.Kind


def _mt(centavos: int) -> str:
    return f"{centavos / 100:+,.2f}".replace(",", " ").replace(".", ",") + " MT"


def _day_bounds(d: date):
    return datetime.combine(d, time.min, tzinfo=MAPUTO), datetime.combine(d, time.max, tzinfo=MAPUTO)


def platform_txns(d: date):
    start, end = _day_bounds(d)
    return Transaction.objects.filter(confirmed_at__range=(start, end)).exclude(provider_ref="")


class SimulatedStatementSource:
    """Gera o "ficheiro do provedor" a partir do que o simulador processou. Em produção: SFTP/API do parceiro."""

    def fetch(self, d: date) -> list[dict]:
        rows = []
        for t in platform_txns(d).filter(status__in=[*PAID, Status.REVERSED]):
            rows.append(
                {
                    "provider": t.method,
                    "provider_ref": t.provider_ref,
                    "reference": t.reference,
                    "amount": t.total,
                    "status": "estornado" if t.status == Status.REVERSED else "pago",
                }
            )
        return rows


def import_statement(d: date, rows: list[dict]) -> int:
    with db.atomic():
        StatementLine.objects.filter(business_date=d).delete()  # re-importar o mesmo dia substitui
        StatementLine.objects.bulk_create(StatementLine(business_date=d, **r) for r in rows)
    return len(rows)


def reconcile(d: date) -> ReconciliationRun:
    lines = {(ln.provider, ln.provider_ref): ln for ln in StatementLine.objects.filter(business_date=d)}
    txns = {(t.method, t.provider_ref): t for t in platform_txns(d).select_related("institution")}
    by_ref = {
        t.reference: t
        for t in Transaction.objects.filter(reference__in=[ln.reference for ln in lines.values() if ln.reference])
    }

    items, matched = [], 0
    for key, t in txns.items():
        ln = lines.get(key)
        paid_here = t.status in PAID
        if ln is None:
            if paid_here:
                items.append(
                    Discrepancy(
                        kind=K.MISSING_AT_PROVIDER,
                        institution=t.institution,
                        reference=t.reference,
                        provider_ref=t.provider_ref,
                        platform_amount=t.total,
                        detail="O provedor não reporta este pagamento.",
                    )
                )
            continue
        if ln.amount != t.total:
            items.append(
                Discrepancy(
                    kind=K.AMOUNT,
                    institution=t.institution,
                    reference=t.reference,
                    provider_ref=t.provider_ref,
                    platform_amount=t.total,
                    provider_amount=ln.amount,
                    detail=f"Diferença de {_mt(ln.amount - t.total)}.",
                )
            )
        elif (ln.status == "pago") != paid_here:
            items.append(
                Discrepancy(
                    kind=K.STATUS,
                    institution=t.institution,
                    reference=t.reference,
                    provider_ref=t.provider_ref,
                    platform_amount=t.total,
                    provider_amount=ln.amount,
                    detail=f"Provedor: {ln.status}; plataforma: {t.status}.",
                )
            )
        else:
            matched += 1
    for key, ln in lines.items():
        if key not in txns:
            t = by_ref.get(ln.reference)
            items.append(
                Discrepancy(
                    kind=K.MISSING_AT_PLATFORM,
                    institution=t.institution if t else None,
                    reference=ln.reference,
                    provider_ref=ln.provider_ref,
                    platform_amount=t.total if t else None,
                    provider_amount=ln.amount,
                    detail=f"Estado na plataforma: {t.status}" if t else "Referência desconhecida.",
                )
            )

    with db.atomic():
        run, _ = ReconciliationRun.objects.update_or_create(
            business_date=d,
            defaults={
                "platform_count": len(txns),
                "provider_count": len(lines),
                "matched": matched,
                "discrepancies": len(items),
            },
        )
        run.items.all().delete()
        for i in items:
            i.run = run
        Discrepancy.objects.bulk_create(items)
    return run


@shared_task
def run_daily_reconciliation(business_date: str | None = None) -> int:
    d = date.fromisoformat(business_date) if business_date else timezone.localdate()
    import_statement(d, SimulatedStatementSource().fetch(d))
    return reconcile(d).discrepancies


def inject_demo_divergences(d: date) -> list[str]:
    """Para a demonstração: altera o extracto importado do dia para provocar cada tipo de divergência."""
    lines = list(StatementLine.objects.filter(business_date=d, status="pago").order_by("id"))
    done = []
    if len(lines) >= 1:
        StatementLine.objects.filter(pk=lines[0].pk).update(amount=lines[0].amount + 5_000)
        done.append(f"valor alterado em {lines[0].reference}")
    if len(lines) >= 2:
        StatementLine.objects.filter(pk=lines[1].pk).delete()
        done.append(f"linha removida: {lines[1].reference}")
    if len(lines) >= 3:
        StatementLine.objects.filter(pk=lines[2].pk).update(status="estornado")
        done.append(f"estado alterado em {lines[2].reference}")
    StatementLine.objects.create(
        provider="mpesa",
        business_date=d,
        provider_ref="SIM-MPE-ORFAO001",
        reference="PMZORFAO00000",
        amount=125_000,
        status="pago",
    )
    done.append("pagamento órfão no provedor")
    return done
