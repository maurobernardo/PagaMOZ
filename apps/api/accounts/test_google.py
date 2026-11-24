import base64
import json
import time
from urllib.parse import parse_qs, urlparse

import pytest
from rest_framework.test import APIClient

from accounts import google
from accounts.models import User
from institutions.models import Institution, Membership

pytestmark = pytest.mark.django_db


@pytest.fixture
def configured(settings):
    settings.GOOGLE_CLIENT_ID = "cid.apps.googleusercontent.com"
    settings.GOOGLE_CLIENT_SECRET = "segredo"


def jwt(claims):
    enc = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")  # noqa: E731
    return f"{enc({'alg': 'RS256'})}.{enc(claims)}.assinatura"


def run(c, monkeypatch, flow="cidadao", **override):
    r = c.get(f"/api/auth/google/start?flow={flow}&next=/conta")
    assert r.status_code == 302 and r["Location"].startswith(google.AUTH_URL)
    q = parse_qs(urlparse(r["Location"]).query)
    assert q["scope"] == ["openid email profile"] and q["redirect_uri"][0].endswith("/api/auth/google/callback")
    claims = {
        "aud": "cid.apps.googleusercontent.com",
        "iss": "https://accounts.google.com",
        "exp": time.time() + 300,
        "nonce": c.session["google_oauth"]["nonce"],
        "email": "ana@exemplo.mz",
        "email_verified": True,
        **override,
    }
    monkeypatch.setattr(google, "exchange_code", lambda code: {"id_token": jwt(claims)})
    return c.get(f"/api/auth/google/callback?code=abc&state={q['state'][0]}")


def test_disabled_without_credentials():
    c = APIClient()
    assert c.get("/api/auth/google/status").json() == {"enabled": False}
    assert c.get("/api/auth/google/start?flow=portal").status_code == 503


def test_citizen_login_by_verified_email(configured, monkeypatch):
    User.objects.create_user("+258841230000", email="Ana@Exemplo.mz")
    c = APIClient()
    r = run(c, monkeypatch)
    assert r.status_code == 302 and r["Location"] == "/conta"
    assert c.get("/api/me").json()["phone"] == "+258841230000"


def test_portal_google_still_requires_mfa(configured, monkeypatch, settings):
    settings.PORTAL_REQUIRE_MFA = True
    u = User.objects.create_user("+258841230001", email="ana@exemplo.mz")
    inst = Institution.objects.create(name="X", slug="x")
    Membership.objects.create(user=u, institution=inst, role="admin")
    c = APIClient()
    r = run(c, monkeypatch, flow="portal")
    assert r["Location"] == "/portal?google=1"
    assert c.get("/api/auth/portal/pending").json()["mfa_enrolled"] is False
    assert c.get("/api/portal/x/dashboard").status_code in (401, 403)  # sem MFA ainda não entra


@pytest.mark.parametrize("override,erro", [
    ({"email": "ninguem@exemplo.mz"}, "google_sem_conta"),
    ({"email_verified": False}, "google_invalido"),
    ({"aud": "outro-cliente"}, "google_invalido"),
    ({"nonce": "forjado"}, "google_invalido"),
    ({"exp": time.time() - 10}, "google_invalido"),
])  # fmt: skip
def test_rejections(configured, monkeypatch, override, erro):
    User.objects.create_user("+258841230002", email="ana@exemplo.mz")
    r = run(APIClient(), monkeypatch, **override)
    assert r["Location"] == f"/entrar?erro={erro}"


def test_state_mismatch_and_citizen_cannot_enter_portal(configured, monkeypatch):
    c = APIClient()
    c.get("/api/auth/google/start?flow=portal")
    assert c.get("/api/auth/google/callback?code=x&state=errado")["Location"] == "/portal?erro=google_estado"
    User.objects.create_user("+258841230003", email="ana@exemplo.mz")
    assert run(APIClient(), monkeypatch, flow="portal")["Location"] == "/portal?erro=google_sem_acesso"
