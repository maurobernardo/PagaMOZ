from datetime import date, timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Service
from payments.models import Status, Transaction
from payments.tests import run, svc  # noqa: F401 - fixture reutilizada

from .insights import bills, method_health
from .scan import interpret

pytestmark = pytest.mark.django_db


def test_method_health_recommends_the_method_that_works(svc, django_capture_on_commit_callbacks):  # noqa: F811
    for i in range(4):
        run(svc, django_capture_on_commit_callbacks, key=f"ok-{i}-xxxxxxxx", method="mpesa")
    for i in range(3):
        run(
            svc,
            django_capture_on_commit_callbacks,
            key=f"ko-{i}-xxxxxxxx",
            method="emola",
            payer_phone="+258861234567",
            scenario="falha",
        )
    h = {x["method"]: x for x in method_health()}
    assert h["mpesa"]["state"] == "bom" and h["mpesa"]["recommended"]
    assert h["emola"]["state"] == "falhas" and not h["emola"]["recommended"]
    assert h["cartao"]["state"] == "sem_dados"


def test_bills_find_recurring_payment_and_predict_next(svc, django_capture_on_commit_callbacks):  # noqa: F811
    u = User.objects.create_user("+258845555555")
    c = APIClient()
    c.force_login(u)
    for i in range(3):
        _, t = run(svc, django_capture_on_commit_callbacks, key=f"rec-{i}-xxxxxxxx", client=c)
        Transaction.objects.filter(pk=t.pk).update(created_at=timezone.now() - timedelta(days=60 - 30 * i))
    b = bills(u)
    assert len(b["recurring"]) == 1
    r = b["recurring"][0]
    assert r["every_days"] == 30 and r["key"] == "123456" and r["days_left"] == 30


def test_credelec_forecast_days_left():
    from types import SimpleNamespace as N

    from .insights import _credelec_forecast

    today = date(2026, 11, 26)
    ts = [N(amount=30_000), N(amount=30_000), N(amount=60_000)]
    dates = [date(2026, 10, 27), date(2026, 11, 11), date(2026, 11, 26)]
    f = _credelec_forecast(ts, dates, today)
    assert f["daily"] == 2000 and f["days_left"] == 30  # 600 MT / 30 dias = 20 MT/dia; 600 MT dá 30 dias


def test_scan_reads_edm_bill_and_traffic_fine():
    call_command("seed_demo", verbosity=0)
    services = Service.objects.filter(is_active=True).select_related("institution")
    edm = interpret(
        "ELECTRICIDADE DE MOCAMBIQUE, E.P.\nFactura de consumo\nN.º Cliente: 3045 1122\n"
        "Período: Outubro 2026\nTotal a pagar: 1.240,50 MT\nData limite: 15/12/2026",
        services,
    )
    assert edm["service_name"].startswith("Fatura de electricidade")
    assert edm["fields"] == {"cliente": "30451122"} and edm["amount"] == 124050 and edm["due_date"] == "2026-12-15"
    assert edm["confidence"] >= 0.7

    multa = interpret("INATTER - Auto de infracção\nMatrícula: afg 123 mc\nValor da multa: 2 000,00 MT", services)
    assert multa["service_name"] == "Multas de trânsito" and multa["fields"]["matricula"].replace(" ", "") == "AFG123MC"

    assert interpret("lista de compras: pão, leite", services)["service"] is None


def test_scan_endpoint_accepts_text_and_logs_event():
    call_command("seed_demo", verbosity=0)
    r = APIClient().post("/api/intel/scan", {"text": "Credelec recarga\nContador 12345678901"})
    assert r.status_code == 200 and r.json()["fields"] == {"contador": "12345678901"}
    from .models import Event

    assert Event.objects.filter(kind="scan").exists()
    assert APIClient().post("/api/intel/scan", {}).status_code == 400
    assert Status.CONFIRMED  # silencia import não usado em alguns linters
