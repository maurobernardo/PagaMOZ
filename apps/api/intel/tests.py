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


def test_assistant_understands_pay_status_help_and_saved_names():
    from accounts.models import SavedObligation

    from .assistant import reply

    call_command("seed_demo", verbosity=0)
    services = Service.objects.filter(is_active=True).select_related("institution", "category")

    r = reply("paga 500 de credelec", services)
    a = r["actions"][0]
    assert a["type"] == "service" and Service.objects.get(pk=a["service"]).slug == "credelec" and a["amount"] == 50_000

    r = reply("quero pagar a multa do carro", services)
    assert Service.objects.get(pk=r["actions"][0]["service"]).institution.slug == "inatter"

    assert reply("estado PMZAAAAAAAAAA", services)["reply"].startswith("Não encontro")
    assert reply("ajuda", services)["suggestions"]

    u = User.objects.create_user("+258846666666")
    cred = Service.objects.get(slug="credelec")
    SavedObligation.objects.create(user=u, service=cred, label="Casa da mãe", fields={"contador": "12345678901"})
    r = reply("Paga 300 MT da casa da mae", services, u)
    a = r["actions"][0]
    assert a["fields"] == {"contador": "12345678901"} and a["amount"] == 30_000 and "Casa da mãe" in r["reply"]


def test_assistant_does_not_take_phone_numbers_as_amounts():
    from .assistant import _amount

    assert _amount("recarga 841234567") is None and _amount("recarga 100 para 841234567") == 10_000


def test_scam_check_levels():
    from .scam import check

    alto = check("URGENTE: a sua conta M-Pesa foi bloqueada. Envie o seu PIN para 84 123 4567 para desbloquear.")
    assert alto["level"] == "alto" and len(alto["reasons"]) >= 3
    medio = check("Enviei 500 MT por engano para o seu número, devolva por favor")
    assert medio["level"] in ("medio", "alto")
    assert check("A sua fatura de água de Novembro está disponível.")["level"] == "baixo"
    r = APIClient().post(
        "/api/intel/scam-check", {"message": "Ganhou um prémio! Pague a taxa de 200 MT"}, format="json"
    )
    assert r.status_code == 200 and r.json()["level"] == "alto"
