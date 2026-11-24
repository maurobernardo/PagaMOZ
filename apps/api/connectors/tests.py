"""Fase 3 — um serviço de cada nível de ponta a ponta, mais casos de abuso."""

import io
import json
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Service
from connectors.models import Quote
from institutions.models import Membership
from ledger.models import trial_balance
from payments.models import DeadLetter, Transaction
from payments.tasks import notify_institution
from servicerequests.models import ServiceRequest

pytestmark = pytest.mark.django_db
PDF = b"%PDF-1.4\n% demo\n"


@pytest.fixture(autouse=True)
def demo(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    call_command("seed_demo", stdout=io.StringIO())


def svc(inst, slug):
    return Service.objects.get(institution__slug=inst, slug=slug)


def pay(c, cb, key, **body):
    with cb(execute=True):
        r = c.post("/api/payments", {"method": "mpesa", "scenario": "sucesso", **body}, format="json",
                   HTTP_IDEMPOTENCY_KEY=key)  # fmt: skip
    return r


def portal(inst_slug, role="admin"):
    u = User.objects.create_user(f"+2588411{abs(hash((inst_slug, role))) % 100000:05d}")
    Membership.objects.create(user=u, institution_id=Service.objects.filter(institution__slug=inst_slug)
                              .values("institution_id")[:1], role=role)  # fmt: skip
    c = APIClient()
    c.force_authenticate(u)
    return c


# ---------- Nível 1: consulta + pagamento em tempo real ----------


def test_level1_lookup_quote_pay_notify(django_capture_on_commit_callbacks):
    s = svc("energia-austral", "fatura")
    c = APIClient()
    q = c.post(f"/api/catalog/services/{s.id}/quote", {"fields": {"contrato": "12345678"}}, format="json")
    assert q.status_code == 201, q.json()
    q = q.json()
    again = c.post(f"/api/catalog/services/{s.id}/quote", {"fields": {"contrato": "12345678"}}, format="json")
    assert again.json()["amount"] == q["amount"]  # determinístico
    assert "*" in q["holder"] and q["total"] >= q["amount"]

    r = pay(c, django_capture_on_commit_callbacks, "lvl1-0001", service=s.id, quote=q["id"])
    assert r.status_code == 201, r.json()
    t = Transaction.objects.get(reference=r.json()["reference"])
    assert t.status == "CONFIRMADA" and t.amount == q["amount"]
    assert t.institution_ref == f"SIM-ACK-{t.reference}" and t.institution_notified_at
    assert trial_balance() == 0

    # Cotação é de uso único.
    r2 = pay(c, django_capture_on_commit_callbacks, "lvl1-0002", service=s.id, quote=q["id"])
    assert r2.status_code == 400


def test_level1_amount_cannot_be_forged():
    s = svc("energia-austral", "fatura")
    r = APIClient().post("/api/payments", {"service": s.id, "method": "mpesa", "amount": 100, "fields": {
        "contrato": "12345678"}}, format="json", HTTP_IDEMPOTENCY_KEY="forge-001")  # fmt: skip
    assert r.status_code == 400


def test_quote_expired_or_other_service():
    s = svc("energia-austral", "fatura")
    other = svc("aguas-do-indico", "fatura")
    q = Quote.objects.create(service=s, payload={"contrato": "123456"}, amount=1000, description="x",
                             expires_at=timezone.now() - timedelta(seconds=1))  # fmt: skip
    c = APIClient()
    body = {"method": "mpesa", "quote": q.id}
    assert c.post("/api/payments", {**body, "service": s.id}, format="json",
                  HTTP_IDEMPOTENCY_KEY="exp-00001").status_code == 400  # fmt: skip
    Quote.objects.filter(pk=q.pk).update(expires_at=timezone.now() + timedelta(minutes=5))
    assert c.post("/api/payments", {**body, "service": other.id}, format="json",
                  HTTP_IDEMPOTENCY_KEY="exp-00002").status_code == 400  # fmt: skip


def test_lookup_not_found_and_unavailable():
    s = svc("aguas-do-indico", "fatura")
    c = APIClient()
    url = f"/api/catalog/services/{s.id}/quote"
    assert c.post(url, {"fields": {"contrato": "12340000"}}, format="json").status_code == 404
    r = c.post(url, {"fields": {"contrato": "12349999"}}, format="json")
    assert r.status_code == 503 and r.headers["Retry-After"]
    assert c.post(url, {"fields": {"contrato": "abc"}}, format="json").status_code == 400
    fixed = svc("transito-demo", "inspeccao")
    assert c.post(f"/api/catalog/services/{fixed.id}/quote", {"fields": {}}, format="json").status_code == 400


# ---------- Nível 2: referência de pagamento ----------


def test_level2_reference_payment(django_capture_on_commit_callbacks):
    s = svc("transito-demo", "multa")
    c = APIClient()
    q = c.post(f"/api/catalog/services/{s.id}/quote", {"fields": {"referencia": "MUL2026ABC1"}}, format="json").json()
    r = pay(c, django_capture_on_commit_callbacks, "lvl2-0001", service=s.id, quote=q["id"], method="cartao")
    t = Transaction.objects.get(reference=r.json()["reference"])
    assert t.status == "CONFIRMADA" and t.payload == {"referencia": "MUL2026ABC1"} and t.institution_notified_at


# ---------- Nível 3: pedido assistido ----------


def create_request(c, s, files=None, **fields):
    form = {"nome_completo": "Ana Demo", "data_nascimento": "1990-01-01", **fields}
    files = files if files is not None else {"anexo_bi": SimpleUploadedFile("bi.pdf", PDF, "application/pdf")}
    return c.post("/api/requests", {"service": s.id, "fields": json.dumps(form), **files}, format="multipart")


def test_level3_request_pay_and_institution_workflow(django_capture_on_commit_callbacks):
    s = svc("registo-civil-demo", "certidao-nascimento")
    c = APIClient()
    r = create_request(c, s)
    assert r.status_code == 201, r.json()
    code = r.json()["code"]
    assert r.json()["status"] == "AGUARDA_PAGAMENTO"
    assert "form" not in r.json()

    # Sem pedido não se paga um serviço de nível 3.
    assert pay(c, django_capture_on_commit_callbacks, "lvl3-0000", service=s.id).status_code == 400
    p = pay(c, django_capture_on_commit_callbacks, "lvl3-0001", service=s.id, request=code)
    assert p.status_code == 201, p.json()
    assert p.json()["total"] >= s.amount
    assert c.get(f"/api/requests/{code}").json()["status"] == "SUBMETIDO"
    # Segundo pagamento do mesmo pedido é recusado.
    assert pay(c, django_capture_on_commit_callbacks, "lvl3-0002", service=s.id, request=code).status_code == 400

    op = portal("registo-civil-demo", "operador")
    base = f"/api/portal/registo-civil-demo/requests/{code}"
    d = op.get(base).json()
    assert d["form"]["nome_completo"] == "Ana Demo" and d["attachments"][0]["content_type"] == "application/pdf"
    dl = op.get(f"{base}/attachments/{d['attachments'][0]['id']}")
    assert dl.status_code == 200 and b"".join(dl.streaming_content) == PDF

    assert op.post(f"{base}/status", {"status": "CONCLUIDO"}, format="json").status_code == 409
    assert op.post(f"{base}/status", {"status": "EM_ANALISE"}, format="json").status_code == 200
    assert op.post(f"{base}/status", {"status": "PENDENTE_INFO"}, format="json").status_code == 409  # sem nota
    for st in ("APROVADO", "PRONTO", "CONCLUIDO"):
        assert op.post(f"{base}/status", {"status": st, "note": "ok"}, format="json").status_code == 200
    events = [e["status"] for e in c.get(f"/api/requests/{code}").json()["events"]]
    assert events == ["AGUARDA_PAGAMENTO", "SUBMETIDO", "EM_ANALISE", "APROVADO", "PRONTO", "CONCLUIDO"]


def test_level3_tenant_isolation_and_roles():
    s = svc("registo-civil-demo", "certidao-nascimento")
    code = create_request(APIClient(), s).json()["code"]
    outsider = portal("transito-demo")
    assert outsider.get(f"/api/portal/registo-civil-demo/requests/{code}").status_code == 404
    assert outsider.get(f"/api/portal/transito-demo/requests/{code}").status_code == 404
    req = ServiceRequest.objects.get(code=code)
    att = req.attachments.get()
    assert outsider.get(f"/api/portal/transito-demo/requests/{code}/attachments/{att.id}").status_code == 404
    fin = portal("registo-civil-demo", "financeiro")
    assert fin.get(f"/api/portal/registo-civil-demo/requests/{code}").status_code == 200
    assert fin.post(f"/api/portal/registo-civil-demo/requests/{code}/status", {"status": "EM_ANALISE"},
                    format="json").status_code == 403  # fmt: skip


def test_level3_rejects_bad_files():
    s = svc("registo-civil-demo", "certidao-nascimento")
    c = APIClient()
    fake = SimpleUploadedFile("bi.pdf", b"MZ\x90\x00 executavel", "application/pdf")
    assert create_request(c, s, files={"anexo_bi": fake}).status_code == 400
    assert create_request(c, s, files={}).status_code == 400
    big = SimpleUploadedFile("bi.pdf", PDF + b"0" * (5 * 1024 * 1024), "application/pdf")
    assert create_request(c, s, files={"anexo_bi": big}).status_code == 400
    assert not ServiceRequest.objects.exists()


# ---------- Notificação à instituição ----------


def test_institution_notification_dead_letter(monkeypatch, django_capture_on_commit_callbacks):
    s = svc("energia-austral", "recarga")
    from connectors.base import SimulatedConnector

    def down(self, txn):
        raise ConnectionError("instituição em baixo")

    monkeypatch.setattr(SimulatedConnector, "confirm_payment", down)
    r = pay(APIClient(), django_capture_on_commit_callbacks, "notif-001", service=s.id, amount=50_000,
            fields={"contador": "12345678901"})  # fmt: skip
    t = Transaction.objects.get(reference=r.json()["reference"])
    assert t.status == "CONFIRMADA" and not t.institution_notified_at  # o pagamento não depende da instituição
    assert notify_institution.apply(args=(t.pk,), retries=8).get() == "dead-letter"
    assert DeadLetter.objects.filter(kind="connector:confirm").exists()


def test_price_breakdown_before_paying():
    c = APIClient()
    fixed = svc("transito-demo", "inspeccao")
    r = c.post(f"/api/catalog/services/{fixed.id}/price", {}, format="json").json()
    assert r["amount"] == fixed.amount and r["total"] >= r["amount"]
    open_ = svc("energia-austral", "recarga")
    assert c.post(f"/api/catalog/services/{open_.id}/price", {}, format="json").status_code == 400
    assert (
        c.post(f"/api/catalog/services/{open_.id}/price", {"amount": 50_000}, format="json").json()["amount"] == 50_000
    )
