import pytest
from rest_framework.test import APIClient

from accounts.models import OtpChallenge, SavedObligation, User
from catalog.models import Category, Service
from institutions.models import Institution

pytestmark = pytest.mark.django_db


def otp(c, phone="841234567"):
    r = c.post("/api/auth/otp/request", {"phone": phone}, format="json")
    assert r.status_code == 201, r.json()
    return r.json()


def login(c, phone="841234567"):
    code = otp(c, phone)["demo_code"]
    return c.post("/api/auth/otp/verify", {"phone": phone, "code": code}, format="json")


def test_otp_login_creates_user_and_session():
    c = APIClient()
    r = login(c)
    assert r.status_code == 200 and r.json()["phone"] == "+258841234567"
    assert User.objects.get(phone="+258841234567").has_usable_password() is False
    assert c.get("/api/me").json()["phone"] == "+258841234567"
    c.post("/api/auth/logout")
    assert c.get("/api/me").status_code == 403


def test_otp_wrong_code_and_attempt_limit():
    c = APIClient()
    code = otp(c)["demo_code"]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(OtpChallenge.MAX_ATTEMPTS):
        assert c.post("/api/auth/otp/verify", {"phone": "841234567", "code": wrong}, format="json").status_code == 400
    # Esgotou: nem o código certo entra.
    assert c.post("/api/auth/otp/verify", {"phone": "841234567", "code": code}, format="json").status_code == 400


def test_otp_single_use_and_hashed():
    c = APIClient()
    code = otp(c)["demo_code"]
    assert code not in OtpChallenge.objects.get().code_hash
    assert c.post("/api/auth/otp/verify", {"phone": "841234567", "code": code}, format="json").status_code == 200
    assert APIClient().post("/api/auth/otp/verify", {"phone": "841234567", "code": code},
                            format="json").status_code == 400  # fmt: skip


def test_otp_rate_limit_per_phone_and_validation():
    c = APIClient()
    for _ in range(5):
        otp(c, "+258 84 765 4321")
    assert c.post("/api/auth/otp/request", {"phone": "847654321"}, format="json").status_code == 429
    assert c.post("/api/auth/otp/request", {"phone": "12345"}, format="json").status_code == 400


def test_demo_code_hidden_outside_demo(settings):
    settings.DEMO_MODE = False
    assert "demo_code" not in otp(APIClient())


def test_wallet_is_private_and_validated():
    cat = Category.objects.create(name="Água", slug="agua")
    inst = Institution.objects.create(name="A", slug="a")
    s = Service.objects.create(institution=inst, category=cat, name="Fatura", slug="f", integration_level=1,
                               pricing="consulta", fields=[{"name": "contrato", "label": "C", "type": "text",
                                                            "pattern": r"^\d{6}$"}])  # fmt: skip
    a, b = APIClient(), APIClient()
    login(a, "841111111")
    login(b, "842222222")
    r = a.post("/api/me/obligations", {"label": "Casa", "service": s.id, "fields": {"contrato": "123456"}},
               format="json")  # fmt: skip
    assert r.status_code == 201, r.json()
    assert a.post("/api/me/obligations", {"label": "X", "service": s.id, "fields": {"contrato": "1"}},
                  format="json").status_code == 400  # fmt: skip
    oid = r.json()["id"]
    assert b.get("/api/me/obligations").json() == []
    assert b.delete(f"/api/me/obligations/{oid}").status_code == 404
    assert a.delete(f"/api/me/obligations/{oid}").status_code == 204
    assert not SavedObligation.objects.exists()


def test_otp_throttle_not_consumed_by_other_requests():
    c = APIClient()
    for _ in range(15):
        c.get("/api/catalog/categories")
    assert c.post("/api/auth/otp/request", {"phone": "843333333"}, format="json").status_code == 201


def test_csrf_endpoint_returns_token(client):
    r = client.get("/api/auth/csrf")
    assert r.status_code == 200 and len(r.json()["csrf"]) >= 32


def test_profile_patch_updates_name_and_province(client, django_user_model):
    u = django_user_model.objects.create_user("+258841111111")
    client.force_login(u)
    r = client.patch(
        "/api/me", {"first_name": "Ana", "province": "Gaza", "district": "Xai-Xai"}, content_type="application/json"
    )
    assert r.status_code == 200 and r.json()["province"] == "Gaza"
    u.refresh_from_db()
    assert (u.first_name, u.district) == ("Ana", "Xai-Xai")
    assert client.patch("/api/me", {"province": "Lisboa"}, content_type="application/json").status_code == 400


def test_profile_rejects_district_from_other_province(client, django_user_model):
    client.force_login(django_user_model.objects.create_user("+258842222222"))
    r = client.patch("/api/me", {"province": "Gaza", "district": "Matola"}, content_type="application/json")
    assert r.status_code == 400
