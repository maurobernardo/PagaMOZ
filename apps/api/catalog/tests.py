import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import User
from audit.models import AuditLog
from catalog.models import Category, Service
from institutions.models import Institution, Membership

pytestmark = pytest.mark.django_db
R = Membership.Role


@pytest.fixture
def world():
    cat = Category.objects.create(name="Água", slug="agua")
    a = Institution.objects.create(name="Inst A", slug="inst-a", commission_bps=200, commission_payer="cidadao")
    b = Institution.objects.create(name="Inst B", slug="inst-b")
    sa = Service.objects.create(institution=a, category=cat, name="Fatura A", slug="fatura", integration_level=1,
                                pricing="consulta")  # fmt: skip
    sb = Service.objects.create(institution=b, category=cat, name="Fatura B", slug="fatura", integration_level=1,
                                pricing="consulta")  # fmt: skip

    def member(phone, inst, role):
        u = User.objects.create_user(phone)
        Membership.objects.create(user=u, institution=inst, role=role)
        c = APIClient()
        c.force_authenticate(u)
        return c

    return {
        "cat": cat, "a": a, "b": b, "sa": sa, "sb": sb,
        "admin_a": member("+258840000001", a, R.ADMIN),
        "op_a": member("+258840000002", a, R.OPERATOR),
        "admin_b": member("+258840000003", b, R.ADMIN),
    }  # fmt: skip


# ---------- Isolamento multi-tenant ----------


def test_member_sees_only_own_services(world):
    r = world["admin_a"].get("/api/portal/inst-a/services")
    assert r.status_code == 200
    assert [s["id"] for s in r.json()["results"]] == [world["sa"].id]


def test_cannot_list_other_institution(world):
    assert world["admin_a"].get("/api/portal/inst-b/services").status_code == 404


def test_cannot_read_other_service_through_own_url(world):
    # id do serviço de B pedido no URL de A -> não existe para A.
    assert world["admin_a"].get(f"/api/portal/inst-a/services/{world['sb'].id}").status_code == 404


def test_cannot_update_other_institution(world):
    r = world["admin_a"].patch(f"/api/portal/inst-b/services/{world['sb'].id}", {"name": "x"}, format="json")
    assert r.status_code == 404
    world["sb"].refresh_from_db()
    assert world["sb"].name == "Fatura B"


def test_create_forces_own_institution(world):
    body = {"name": "Nova", "slug": "nova", "category": "agua", "integration_level": 2, "pricing": "fixo",
            "amount": 5000, "institution": world["b"].id}  # fmt: skip
    r = world["admin_a"].post("/api/portal/inst-a/services", body, format="json")
    assert r.status_code == 201, r.json()
    assert Service.objects.get(slug="nova").institution == world["a"]


def test_anonymous_gets_404_on_portal(world):
    assert APIClient().get("/api/portal/inst-a/services").status_code in (401, 403, 404)


def test_suspended_institution_blocks_portal(world):
    Institution.objects.filter(pk=world["a"].pk).update(status=Institution.Status.SUSPENDED)
    assert world["admin_a"].get("/api/portal/inst-a/services").status_code == 404


# ---------- RBAC ----------


def test_operator_can_read_but_not_write(world):
    c = world["op_a"]
    assert c.get("/api/portal/inst-a/services").status_code == 200
    r = c.patch(f"/api/portal/inst-a/services/{world['sa'].id}", {"name": "x"}, format="json")
    assert r.status_code == 403


def test_fixed_price_requires_amount(world):
    body = {"name": "X", "slug": "x", "category": "agua", "integration_level": 2, "pricing": "fixo"}
    r = world["admin_a"].post("/api/portal/inst-a/services", body, format="json")
    assert r.status_code == 400
    assert "amount" in r.json()


# ---------- Auditoria ----------


def test_writes_are_audited_and_immutable(world):
    world["admin_a"].patch(f"/api/portal/inst-a/services/{world['sa'].id}", {"name": "Novo"}, format="json")
    log = AuditLog.objects.get(action="service.update")
    assert log.institution == world["a"] and log.data == {"fields": ["name"]}
    with pytest.raises(PermissionError):
        log.save()
    with pytest.raises(PermissionError):
        log.delete()
    with pytest.raises(PermissionError):
        AuditLog.objects.all().delete()
    with pytest.raises(PermissionError):
        AuditLog.objects.update(action="x")


# ---------- Catálogo público e comissões ----------


def test_public_catalog_hides_inactive_and_suspended(world):
    Service.objects.filter(pk=world["sb"].pk).update(is_active=False)
    r = APIClient().get("/api/catalog/services?category=agua")
    assert [s["id"] for s in r.json()["results"]] == [world["sa"].id]
    Institution.objects.filter(pk=world["a"].pk).update(status=Institution.Status.SUSPENDED)
    assert APIClient().get("/api/catalog/services").json()["count"] == 0


def test_public_catalog_does_not_expose_commission_or_settlement(world):
    s = APIClient().get(f"/api/catalog/services/{world['sa'].id}").json()
    assert not {"commission_bps", "commission_fixed"} & s.keys()
    assert "settlement_bank" not in s["institution"]


def test_commission_service_overrides_institution(world):
    sa = world["sa"]
    assert sa.effective_commission() == {"bps": 200, "fixed": 0, "payer": "cidadao"}
    sa.commission_bps = 50
    assert sa.effective_commission()["bps"] == 50


# ---------- Seed ----------


def test_seed_covers_all_categories_and_is_idempotent():
    call_command("seed_demo")
    call_command("seed_demo")
    assert Category.objects.count() == 8
    for cat in Category.objects.all():
        assert cat.services.exists(), cat.slug
    for inst in Institution.objects.all():
        assert 2 <= inst.services.count() <= 5, inst.slug
        assert inst.is_demo
    assert set(Service.objects.values_list("integration_level", flat=True)) == {1, 2, 3}
    for s in Service.objects.filter(pricing="fixo"):
        s.full_clean()
