"""Para as instituições: receita prevista para os próximos dias e pagadores que costumam pagar e estão atrasados.

Previsão por dia da semana (média das últimas 8 semanas, com intervalo pelo mínimo e máximo observados).
Explicável e honesta: com menos de 2 semanas de histórico diz que ainda não há dados suficientes.
"""

from collections import defaultdict
from datetime import timedelta
from statistics import mean, median

from django.utils import timezone

from payments.models import Status, Transaction

OK = (Status.CONFIRMED, Status.SETTLED)
DAYS_PT = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def revenue_forecast(institution, days: int = 7, weeks: int = 8) -> dict:
    today = timezone.localdate()
    start = today - timedelta(weeks=weeks)
    per_day: dict = defaultdict(int)
    for t in Transaction.objects.filter(institution=institution, status__in=OK, confirmed_at__date__gte=start).only(
        "amount", "confirmed_at"
    ):
        per_day[timezone.localtime(t.confirmed_at).date()] += t.amount
    span = (today - start).days
    history = [(start + timedelta(days=i), per_day.get(start + timedelta(days=i), 0)) for i in range(span)]
    if sum(1 for _, v in history if v) < 3 or span < 14:
        return {
            "enough": False,
            "days": [],
            "total": 0,
            "explain": "Ainda não há histórico suficiente (precisa de 2 semanas).",
        }
    by_wd: dict = defaultdict(list)
    for d, v in history:
        by_wd[d.weekday()].append(v)
    out = []
    for i in range(1, days + 1):
        d = today + timedelta(days=i)
        vals = by_wd[d.weekday()]
        out.append(
            {
                "date": d.isoformat(),
                "weekday": DAYS_PT[d.weekday()],
                "expected": round(mean(vals)),
                "low": min(vals),
                "high": max(vals),
            }
        )
    return {
        "enough": True,
        "days": out,
        "total": sum(x["expected"] for x in out),
        "explain": f"Média de cada dia da semana nas últimas {weeks} semanas; "
        "a faixa mostra o mínimo e o máximo vistos.",
    }


def late_payers(institution, grace_days: int = 3, limit: int = 50) -> list[dict]:
    """Quem pagou o mesmo serviço pelo menos 3 vezes com regularidade e já passou da data habitual."""
    today = timezone.localdate()
    groups: dict = defaultdict(list)
    for t in (
        Transaction.objects.filter(institution=institution, status__in=OK)
        .exclude(user=None)
        .select_related("service", "user")
        .order_by("confirmed_at")
    ):
        key = next((str(v) for v in (t.payload or {}).values() if isinstance(v, str) and v), "")
        groups[(t.user_id, t.service_id, key)].append(t)
    out = []
    for (_, _, key), ts in groups.items():
        if len(ts) < 3:
            continue
        dates = [timezone.localtime(t.confirmed_at).date() for t in ts]
        gaps = [(b - a).days for a, b in zip(dates, dates[1:], strict=False) if (b - a).days > 0]
        if not gaps:
            continue
        every = round(median(gaps))
        expected = dates[-1] + timedelta(days=every)
        late = (today - expected).days
        if late > grace_days:
            u = ts[-1].user
            out.append({
                "service_name": ts[-1].service.name, "key": key, "days_late": late, "every_days": every,
                "expected_date": expected.isoformat(), "typical_amount": round(median(t.amount for t in ts)),
                "payer": (u.get_full_name() or u.phone[:-4] + "••••"),
            })  # fmt: skip
    return sorted(out, key=lambda x: -x["days_late"])[:limit]
