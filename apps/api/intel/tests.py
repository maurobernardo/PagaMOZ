import re
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


def test_ussd_menus_and_credelec_payment_end_to_end():
    call_command("seed_demo", verbosity=0)
    c = APIClient()

    def ussd(text, phone="+258841234567"):
        r = c.post("/api/ussd", {"sessionId": "s1", "phoneNumber": phone, "text": text})
        assert r.status_code == 200
        return r.content.decode()

    assert ussd("").startswith("CON PagaMOZ") and "1. Recarga Credelec" in ussd("")
    assert ussd("1").startswith("CON") and ussd("1*12345678901").startswith("CON Valor")
    assert ussd("1*123").startswith("END Contador inválido")
    confirm = ussd("1*12345678901*200")
    assert confirm.startswith("CON Contador 12345678901") and "Pagar 200 MT" in confirm
    done = ussd("1*12345678901*200*1")
    assert done.startswith("END Pedido enviado ao M-Pesa")
    ref = re.search(r"PMZ[0-9A-Z]{10}", done).group(0)
    t = Transaction.objects.get(reference=ref)
    assert t.method == "mpesa" and t.payer_phone == "+258841234567" and t.amount == 20_000
    assert ussd(f"3*{ref}").startswith(f"END {ref}:")
    assert ussd("1*12345678901*200*2") == "END Cancelado."


def test_ussd_airtime_checks_operator_and_uses_payer_wallet():
    call_command("seed_demo", verbosity=0)
    c = APIClient()
    r = c.post("/api/ussd", {"phoneNumber": "+258861112222", "text": "2*2*0*100*1"}).content.decode()
    assert r.startswith("END Pedido enviado ao e-Mola")
    r = c.post("/api/ussd", {"phoneNumber": "+258861112222", "text": "2*1*0"}).content.decode()
    assert r == "END Número não é desta operadora."
    r = c.post("/api/ussd", {"phoneNumber": "+258211112222", "text": "2*1*841234567*100*1"}).content.decode()
    assert "não tem carteira" in r


def test_revenue_forecast_needs_history_and_late_payers_empty_without_data():
    from institutions.models import Institution

    from .forecast import late_payers, revenue_forecast

    inst = Institution.objects.create(name="X", slug="x")
    assert revenue_forecast(inst)["enough"] is False and late_payers(inst) == []


def test_split_bill_shares_are_paid_once_and_sum_to_total(django_capture_on_commit_callbacks):
    from .split import shares_for

    assert shares_for(100_001, 3) == [33_334, 33_334, 33_333]
    call_command("seed_demo", verbosity=0)
    c = APIClient()
    cred = Service.objects.get(slug="credelec")
    r = c.post(
        "/api/splits",
        {"service": cred.id, "fields": {"contador": "12345678901"}, "total": 90_000, "names": ["Ana", "Bento", ""]},
        format="json",
    )
    assert r.status_code == 201, r.json()
    sp = r.json()
    assert [s["amount"] for s in sp["shares"]] == [30_000, 30_000, 30_000] and sp["shares"][2]["name"] == "Pessoa 3"
    share = sp["shares"][0]

    def pay(key, amount=30_000):
        body = {
            "service": cred.id,
            "fields": {"contador": "12345678901"},
            "amount": amount,
            "method": "mpesa",
            "payer_phone": "+258841234567",
            "split_share": share["id"],
        }
        with django_capture_on_commit_callbacks(execute=True):
            return c.post("/api/payments", body, format="json", HTTP_IDEMPOTENCY_KEY=key)

    assert pay("split-wrong-amt", 25_000).status_code == 400
    assert pay("split-share-0001").status_code == 201
    assert pay("split-share-0002").status_code == 400  # a mesma parte não se paga duas vezes
    d = c.get(f"/api/splits/{sp['code']}").json()
    assert d["shares"][0]["state"] == "pago" and d["paid"] == 30_000

    fatura = Service.objects.get(institution__slug="edm", slug="fatura")
    r = c.post(
        "/api/splits",
        {"service": fatura.id, "fields": {"cliente": "12345678"}, "total": 90_000, "names": ["A", "B"]},
        format="json",
    )
    assert r.status_code == 400
