"""Inteligência simples e explicável: saúde dos métodos, contas recorrentes e previsão Credelec.

Tudo é calculado a partir dos pagamentos reais; quando há poucos dados diz-se "sem dados" em vez de inventar.
"""

from datetime import date, timedelta
from statistics import median

from django.db.models import Count, Q
from django.utils import timezone

from payments.models import Method, Status, Transaction

OK = (Status.CONFIRMED, Status.SETTLED)
WINDOW = timedelta(minutes=60)
MIN_SAMPLE = 3


def method_health(now=None) -> list[dict]:
    """Taxa de sucesso por método na última hora (pagamentos que já tiveram resposta do provedor)."""
    now = now or timezone.now()
    rows = (
        Transaction.objects.filter(updated_at__gte=now - WINDOW, status__in=[*OK, Status.FAILED])
        .values("method")
        .annotate(ok=Count("pk", filter=Q(status__in=OK)), failed=Count("pk", filter=Q(status=Status.FAILED)))
    )
    stats = {r["method"]: r for r in rows}
    out = []
    for m in Method.values:
        r = stats.get(m, {"ok": 0, "failed": 0})
        n = r["ok"] + r["failed"]
        rate = r["ok"] / n if n else None
        state = "sem_dados" if n < MIN_SAMPLE else "bom" if rate >= 0.9 else "instavel" if rate >= 0.6 else "falhas"
        out.append({"method": m, "ok": r["ok"], "failed": r["failed"], "rate": rate, "state": state})
    good = [x for x in out if x["state"] == "bom"]
    best = max(good, key=lambda x: (x["rate"], x["ok"]))["method"] if good else None
    for x in out:
        x["recommended"] = x["method"] == best
    return out


def _key(txn) -> str:
    """O que identifica 'a mesma conta' dentro de um serviço: o primeiro campo preenchido (contador, cliente...)."""
    p = txn.payload or {}
    for f in txn.service.fields or []:
        if f.get("type") not in ("file", "select") and p.get(f["name"]):
            return str(p[f["name"]])
    return ""


def bills(user, today: date | None = None) -> dict:
    """Contas da casa: pagamentos que se repetem (com data e valor previstos) e previsão Credelec."""
    today = today or timezone.localdate()
    txns = list(
        Transaction.objects.filter(user=user, status__in=OK)
        .select_related("service", "institution")
        .order_by("created_at")
    )
    groups: dict[tuple, list] = {}
    for t in txns:
        groups.setdefault((t.service_id, _key(t)), []).append(t)

    recurring, credelec = [], []
    for (_, key), ts in groups.items():
        s = ts[-1].service
        dates = [timezone.localtime(t.created_at).date() for t in ts]
        last = ts[-1]
        item = {
            "service": s.id, "service_name": s.name, "institution_name": last.institution.name,
            "institution_slug": last.institution.slug, "key": key, "times": len(ts),
            "last_date": dates[-1].isoformat(), "last_amount": last.amount, "payload": last.payload or {},
        }  # fmt: skip
        if (s.connector_config or {}).get("profile") == "credelec":
            credelec.append({**item, **_credelec_forecast(ts, dates, today)})
            continue
        if len(ts) < 2:
            continue
        gaps = [(b - a).days for a, b in zip(dates, dates[1:], strict=False) if (b - a).days > 0]
        if not gaps:
            continue
        every = round(median(gaps))
        nxt = dates[-1] + timedelta(days=every)
        recurring.append({
            **item, "every_days": every, "typical_amount": round(median(t.amount for t in ts)),
            "next_date": nxt.isoformat(), "days_left": (nxt - today).days,
            "explain": f"Pagou {len(ts)} vezes, em média de {every} em {every} dias.",
        })  # fmt: skip
    recurring.sort(key=lambda x: x["days_left"])
    credelec.sort(key=lambda x: x.get("days_left") if x.get("days_left") is not None else 999)
    return {"recurring": recurring, "credelec": credelec}


def _credelec_forecast(ts, dates, today) -> dict:
    """Dias de energia que restam: gasto por dia = recargas anteriores / dias entre a primeira e a última."""
    if len(ts) < 2 or (dates[-1] - dates[0]).days <= 0:
        return {"days_left": None, "daily": None, "explain": "Precisa de pelo menos duas recargas para estimar."}
    daily = sum(t.amount for t in ts[:-1]) / (dates[-1] - dates[0]).days
    left = round(ts[-1].amount / daily - (today - dates[-1]).days) if daily > 0 else None
    return {
        "daily": round(daily), "days_left": left, "monthly": round(daily * 30),
        "explain": f"Pelas suas últimas {len(ts)} recargas gasta cerca de {round(daily / 100)} MT por dia.",
    }  # fmt: skip
