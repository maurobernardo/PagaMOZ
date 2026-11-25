import io
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework.test import APIClient

from accounts.models import User
from accounts.totp import now_code
from institutions.models import Institution, Membership
from ledger.models import trial_balance
from payments.models import Transaction
from reconciliation.models import Discrepancy
from reconciliation.services import (
    SimulatedStatementSource,
    import_statement,
    inject_demo_divergences,
    reconcile,
)

pytestmark = pytest.mark.django_db
K = Discrepancy.Kind


@pytest.fixture
def demo(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    out = io.StringIO()
    call_command("seed_demo", stdout=out)
    call_command("seed_demo_activity", "--dias", "2", stdout=out)


def member(slug, role="admin", phone=None):
    inst = Institution.objects.get(slug=slug)
    u = User.objects.create_user(phone or f"+25884{abs(hash((slug, role))) % 10**7:07d}")
    Membership.objects.create(user=u, institution=inst, role=role)
    c = APIClient()
    c.force_authenticate(u)
    return c


# ---------- Isolamento: uma instituição só vê os seus dados ----------

ENDPOINTS = ["dashboard", "transactions", "reconciliation", "members", "settlements", "balances", "requests",
             "services"]  # fmt: skip


@pytest.mark.parametrize("ep", ENDPOINTS)
def test_other_institution_gets_404_everywhere(demo, ep):
    c = member("edm")
    assert c.get(f"/api/portal/adrmm/{ep}").status_code == 404
    assert c.get(f"/api/portal/edm/{ep}").status_code == 200


def test_transactions_only_own(demo):
    c = member("edm")
    refs = {t["reference"] for t in c.get("/api/portal/edm/transactions?page_size=1000").json()["results"]}
    own = set(Transaction.objects.filter(institution__slug="edm").values_list("reference", flat=True)[:50])
    assert refs and refs <= set(Transaction.objects.filter(institution__slug="edm")
                                .values_list("reference", flat=True))  # fmt: skip
    assert own & refs
    other = Transaction.objects.filter(institution__slug="adrmm").first()
    assert c.post(f"/api/portal/edm/transactions/{other.reference}/reverse",
                  {"reason": "teste de isolamento"}, format="json").status_code == 404  # fmt: skip


def test_export_csv_and_xlsx_scoped(demo):
    c = member("edm")
    r = c.get("/api/portal/edm/transactions?export=csv")
    assert r.status_code == 200 and r["Content-Type"].startswith("text/csv")
    body = r.content.decode("utf-8-sig")
    lines = body.strip().splitlines()
    assert lines[0].startswith("Referência;Estado")
    n = Transaction.objects.filter(institution__slug="edm").count()
    assert len(lines) == n + 1
    other_ref = Transaction.objects.filter(institution__slug="adrmm").first().reference
    assert other_ref not in body
    x = c.get("/api/portal/edm/transactions?export=xlsx")
    ws = load_workbook(io.BytesIO(x.content)).active
    assert ws.max_row == n + 1


def test_filters(demo):
    c = member("edm")
    r = c.get("/api/portal/edm/transactions?status=FALHADA").json()["results"]
    assert all(t["status"] == "FALHADA" for t in r)
    today = timezone.localdate().isoformat()
    r = c.get(f"/api/portal/edm/transactions?date_from={today}&date_to={today}").json()["results"]
    assert all(t["created_at"][:10] >= (timezone.localdate() - timedelta(days=1)).isoformat() for t in r)
    assert c.get("/api/portal/edm/transactions?date_from=ontem").status_code == 400


def test_dashboard_numbers_match_db(demo):
    c = member("edm", "operador")
    d = c.get("/api/portal/edm/dashboard").json()
    paid = Transaction.objects.filter(institution__slug="edm",
                                      status__in=["CONFIRMADA", "LIQUIDADA", "EM_DISPUTA"])  # fmt: skip
    assert d["month"]["count"] == paid.count()
    assert d["month"]["net"] == sum(t.institution_net for t in paid)
    assert len(d["daily"]) == 30 and sum(x["count"] for x in d["daily"]) == paid.count()
    assert d["balances"]["a_liquidar"] == sum(t.institution_net for t in paid.filter(status="CONFIRMADA"))
    assert trial_balance() == 0


def test_reverse_permissions_and_rules(demo):
    t = Transaction.objects.filter(institution__slug="edm", status="CONFIRMADA").first()
    url = f"/api/portal/edm/transactions/{t.reference}/reverse"
    assert member("edm", "operador").post(url, {"reason": "pedido do cliente"}, format="json").status_code == 403
    fin = member("edm", "financeiro")
    assert fin.post(url, {"reason": "pedido do cliente"}, format="json").json()["status"] == "REVERTIDA"
    settled = Transaction.objects.filter(institution__slug="edm", status="LIQUIDADA").first()
    assert fin.post(f"/api/portal/edm/transactions/{settled.reference}/reverse",
                    {"reason": "pedido do cliente"}, format="json").status_code == 409  # fmt: skip
    assert trial_balance() == 0


def test_members_last_admin_protected(demo):
    c = member("edm")
    ms = c.get("/api/portal/edm/members").json()
    r = c.post("/api/portal/edm/members", {"phone": "849990001", "role": "operador"}, format="json")
    assert r.status_code == 201 and len(c.get("/api/portal/edm/members").json()) == len(ms) + 1
    assert c.post("/api/portal/edm/members", {"phone": "849990001", "role": "operador"},
                  format="json").status_code == 409  # fmt: skip
    inst = Institution.objects.get(slug="edm")
    inst.memberships.filter(role="admin").exclude(user__phone__startswith="+25884").update(role="operador")
    for m in inst.memberships.filter(role="admin"):
        if inst.memberships.filter(role="admin").count() == 1:
            assert c.patch(f"/api/portal/edm/members/{m.id}", {"role": "operador"},
                           format="json").status_code == 409  # fmt: skip
            assert c.delete(f"/api/portal/edm/members/{m.id}").status_code == 409


# ---------- Reconciliação com divergências injectadas ----------


def test_reconciliation_clean_then_injected(demo):
    d = timezone.localdate() - timedelta(days=1)
    import_statement(d, SimulatedStatementSource().fetch(d))
    run = reconcile(d)
    assert run.discrepancies == 0 and run.matched == run.platform_count > 3

    injected = inject_demo_divergences(d)
    run = reconcile(d)
    kinds = sorted(run.items.values_list("kind", flat=True))
    assert kinds == sorted([K.AMOUNT, K.MISSING_AT_PROVIDER, K.STATUS, K.MISSING_AT_PLATFORM]), injected
    amount = run.items.get(kind=K.AMOUNT)
    assert amount.provider_amount - amount.platform_amount == 5_000

    # O portal de cada instituição só vê as divergências que lhe dizem respeito.
    inst = amount.institution
    c = member(inst.slug, "financeiro")
    data = c.get(f"/api/portal/{inst.slug}/reconciliation?date={d}").json()
    assert {i["reference"] for i in data["items"]} <= set(
        Transaction.objects.filter(institution=inst).values_list("reference", flat=True)
    )
    assert amount.reference in {i["reference"] for i in data["items"]}
    r = c.post(f"/api/portal/{inst.slug}/reconciliation/{amount.id}/resolve", {"note": "Confirmado com o banco."},
               format="json")  # fmt: skip
    assert r.json()["resolved"] is True
    other = Institution.objects.exclude(pk=inst.pk).first()
    assert member(other.slug).post(f"/api/portal/{other.slug}/reconciliation/{amount.id}/resolve",
                                   {"note": "tentativa"}, format="json").status_code == 404  # fmt: skip


# ---------- MFA ----------


def test_portal_login_requires_mfa(settings, demo):
    settings.PORTAL_REQUIRE_MFA = True
    u = User.objects.create_user("+258845550001", password="senha-forte-demo")
    Membership.objects.create(user=u, institution=Institution.objects.get(slug="edm"), role="admin")
    c = APIClient()
    r = c.post("/api/auth/portal/login", {"phone": "845550001", "password": "senha-forte-demo"}, format="json")
    assert r.status_code == 200 and r.json()["mfa_enrolled"] is False
    # Sem MFA ainda não há sessão de portal.
    assert c.get("/api/portal/edm/dashboard").status_code in (401, 403)
    setup = c.post("/api/auth/portal/mfa/setup").json()
    assert setup["otpauth_uri"].startswith("otpauth://totp/")
    assert c.post("/api/auth/portal/mfa/verify", {"code": "000000"}, format="json").status_code == 400
    code = now_code(setup["secret"])
    assert c.post("/api/auth/portal/mfa/verify", {"code": code}, format="json").status_code == 200
    assert c.get("/api/portal/edm/dashboard").status_code == 200

    # Código não pode ser reutilizado.
    c2 = APIClient()
    c2.post("/api/auth/portal/login", {"phone": "845550001", "password": "senha-forte-demo"}, format="json")
    assert c2.post("/api/auth/portal/mfa/verify", {"code": code}, format="json").status_code == 400

    # Sessão normal (OTP de cidadão) não dá acesso ao portal.
    c3 = APIClient()
    c3.force_authenticate(u)
    assert c3.get("/api/portal/edm/dashboard").status_code == 403


def test_portal_login_lockout(demo):
    User.objects.create_user("+258845550002", password="certa-123456")
    c = APIClient()
    for _ in range(5):
        assert c.post("/api/auth/portal/login", {"phone": "845550002", "password": "errada"},
                      format="json").status_code == 400  # fmt: skip
    assert c.post("/api/auth/portal/login", {"phone": "845550002", "password": "certa-123456"},
                  format="json").status_code == 429  # fmt: skip


def test_citizen_cannot_use_portal_login(demo):
    User.objects.create_user("+258845550003", password="cidadao-123456")
    r = APIClient().post("/api/auth/portal/login", {"phone": "845550003", "password": "cidadao-123456"}, format="json")
    assert r.status_code == 400
