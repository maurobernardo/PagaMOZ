import io
import json
import logging

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import User
from accounts.totp import now_code
from audit.models import AuditLog
from core.observability import JsonFormatter
from institutions.models import Institution
from payments.models import DeadLetter, Transaction

pytestmark = pytest.mark.django_db


@pytest.fixture
def demo(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    out = io.StringIO()
    call_command("seed_demo", stdout=out)
    call_command("seed_demo_activity", "--dias", "1", stdout=out)


def staff():
    u = User.objects.filter(phone="+258840000000").first() or User.objects.create_user("+258840000000", is_staff=True)
    c = APIClient()
    c.force_authenticate(u)
    return c


ENDPOINTS = ["overview", "institutions", "transactions", "discrepancies", "dead-letters", "audit", "providers",
             "parameters"]  # fmt: skip


@pytest.mark.parametrize("ep", ENDPOINTS)
def test_only_staff(demo, ep):
    assert APIClient().get(f"/api/backoffice/{ep}").status_code in (401, 403)
    inst_admin = User.objects.filter(memberships__role="admin").first()
    c = APIClient()
    c.force_authenticate(inst_admin)
    assert c.get(f"/api/backoffice/{ep}").status_code == 403
    assert staff().get(f"/api/backoffice/{ep}").status_code == 200


def test_staff_requires_mfa_session(settings, demo):
    settings.PORTAL_REQUIRE_MFA = True
    assert staff().get("/api/backoffice/overview").status_code == 403
    User.objects.filter(phone="+258840000000").update(password="")
    u = User.objects.get(phone="+258840000000")
    u.set_password("staff-demo-123")
    u.save()
    c = APIClient()
    c.post("/api/auth/portal/login", {"phone": "840000000", "password": "staff-demo-123"}, format="json")
    secret = c.post("/api/auth/portal/mfa/setup").json()["secret"]
    r = c.post("/api/auth/portal/mfa/verify", {"code": now_code(secret)}, format="json")
    assert r.json()["is_staff"] is True
    assert c.get("/api/backoffice/overview").status_code == 200


def test_overview_consistent(demo):
    d = staff().get("/api/backoffice/overview").json()
    assert d["ledger_balanced"] is True
    paid = Transaction.objects.filter(status__in=["CONFIRMADA", "LIQUIDADA", "EM_DISPUTA"])
    assert d["month"]["count"] == paid.count()
    assert d["institutions"]["activa"] == Institution.objects.count()


def test_create_and_suspend_institution_audited(demo):
    c = staff()
    r = c.post("/api/backoffice/institutions", {"name": "Nova Instituição (Demo)", "slug": "nova-demo",
               "nuit": "400123456", "settlement_bank": "Banco X", "settlement_account_masked": "0001 2345 6789",
               "commission_bps": 120, "commission_payer": "instituicao"}, format="json")  # fmt: skip
    assert r.status_code == 201, r.json()
    assert r.json()["settlement_account_masked"] == "****6789"  # nunca o número completo
    assert c.post("/api/backoffice/institutions", {"name": "X", "slug": "x", "nuit": "12"},
                  format="json").status_code == 400  # fmt: skip
    r = c.patch("/api/backoffice/institutions/energia-austral", {"status": "suspensa"}, format="json")
    assert r.json()["status"] == "suspensa"
    log = AuditLog.objects.get(action="institution.update")
    assert log.data["changes"]["status"] == ["activa", "suspensa"]
    assert AuditLog.objects.filter(action="institution.create").exists()
    # Suspensa: sai do catálogo público.
    assert all(s["institution"]["slug"] != "energia-austral"
               for s in APIClient().get("/api/catalog/services?page_size=500").json()["results"])  # fmt: skip


def test_cross_institution_transactions_and_filter(demo):
    c = staff()
    all_ = c.get("/api/backoffice/transactions").json()["count"]
    one = c.get("/api/backoffice/transactions?institution=energia-austral").json()
    assert all_ == Transaction.objects.count()
    assert one["count"] == Transaction.objects.filter(institution__slug="energia-austral").count() < all_
    assert {t["institution_name"] for t in one["results"]} == {"Energia Austral (Demo)"}


def test_dead_letter_retry_and_resolve(demo):
    t = Transaction.objects.filter(status="CONFIRMADA").first()
    Transaction.objects.filter(pk=t.pk).update(institution_notified_at=None, institution_ref="")
    dl = DeadLetter.objects.create(kind="connector:confirm", payload={"reference": t.reference}, error="x")
    c = staff()
    assert len(c.get("/api/backoffice/dead-letters").json()["results"]) == 1
    assert c.post(f"/api/backoffice/dead-letters/{dl.id}", {"action": "retry"}, format="json").json()["resolved"]
    t.refresh_from_db()
    assert t.institution_ref == f"SIM-ACK-{t.reference}"  # Celery eager: reenvio aconteceu
    assert c.post(f"/api/backoffice/dead-letters/{dl.id}", {"action": "retry"}, format="json").status_code == 404
    assert AuditLog.objects.filter(action="deadletter.retry").exists()


def test_run_reconciliation_now(demo):
    from django.utils import timezone

    r = staff().post("/api/backoffice/reconciliation/run", {"date": timezone.localdate().isoformat()}, format="json")
    assert r.status_code == 200 and r.json()["discrepancies"] == 0


def test_audit_filters(demo):
    staff().patch("/api/backoffice/institutions/aguas-do-indico", {"commission_bps": 90}, format="json")
    r = staff().get("/api/backoffice/audit?action=institution.").json()["results"]
    assert r and all(e["action"].startswith("institution.") for e in r)


# ---------- Observabilidade ----------


def test_request_id_propagated_and_generated():
    c = APIClient()
    r = c.get("/api/health", HTTP_X_REQUEST_ID="abc12345-proxy")
    assert r["X-Request-ID"] == "abc12345-proxy"
    r = c.get("/api/health", HTTP_X_REQUEST_ID="mau\nvalor")  # rejeitado (injecção em logs)
    assert len(r["X-Request-ID"]) == 32


def test_json_log_format():
    rec = logging.LogRecord("pagamoz.access", logging.INFO, __file__, 1, "GET %s", ("/x",), None)
    rec.request_id, rec.fields = "rid1", {"status": 200}
    d = json.loads(JsonFormatter().format(rec))
    assert d["msg"] == "GET /x" and d["request_id"] == "rid1" and d["status"] == 200


def test_metrics_protected_and_prometheus_format(settings, demo):
    c = APIClient()
    settings.METRICS_TOKEN = ""
    assert c.get("/metrics").status_code == 404
    settings.METRICS_TOKEN = "t0k3n"
    assert c.get("/metrics").status_code == 404
    c.get("/api/catalog/categories")
    body = c.get("/metrics", HTTP_AUTHORIZATION="Bearer t0k3n").content.decode()
    assert 'pagamoz_http_requests_total{method="GET",route="api/catalog/categories",status="2xx"}' in body
    assert "pagamoz_payments_24h{" in body and "pagamoz_dead_letters 0" in body
