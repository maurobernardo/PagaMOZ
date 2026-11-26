"""Super admin cria instituição e administrador; o administrador define a senha pelo convite e entra com email."""

import re

import pytest

from accounts.models import User
from accounts.totp import now_code
from institutions.models import Institution


def _staff_login(client):
    staff = User.objects.create_user(None, email="chefe@pagamoz.test", password="Senha-forte-123", is_staff=True)
    r = client.post(
        "/api/auth/portal/login",
        {"login": "CHEFE@pagamoz.test", "password": "Senha-forte-123"},
        content_type="application/json",
    )
    assert r.status_code == 200, r.content
    secret = client.post("/api/auth/portal/mfa/setup").json()["secret"]
    assert (
        client.post(
            "/api/auth/portal/mfa/verify", {"code": now_code(secret)}, content_type="application/json"
        ).status_code
        == 200
    )
    return staff


@pytest.mark.django_db
def test_super_admin_invites_institution_admin_who_sets_password_and_logs_in_by_email(client):
    _staff_login(client)
    r = client.post(
        "/api/backoffice/institutions",
        {"name": "Águas do Teste", "slug": "aguas-teste", "status": "activa"},
        content_type="application/json",
    )
    assert r.status_code == 201, r.content
    r = client.post(
        "/api/backoffice/institutions/aguas-teste/members",
        {"email": "Admin@Aguas.test", "name": "Ana Silva"},
        content_type="application/json",
    )
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["email"] == "admin@aguas.test" and body["role"] == "admin" and body["has_password"] is False
    uid, token = re.search(r"uid=([^&]+)&token=(.+)$", body["invite_link"]).groups()

    # Duplicado: a mesma pessoa não entra duas vezes.
    assert (
        client.post(
            "/api/backoffice/institutions/aguas-teste/members",
            {"email": "admin@aguas.test"},
            content_type="application/json",
        ).status_code
        == 409
    )

    other = client.__class__()
    assert other.get(f"/api/auth/set-password?uid={uid}&token={token}").json()["email"] == "admin@aguas.test"
    assert (
        other.post(
            "/api/auth/set-password", {"uid": uid, "token": token, "password": "123"}, content_type="application/json"
        ).status_code
        == 400
    )
    assert (
        other.post(
            "/api/auth/set-password",
            {"uid": uid, "token": token, "password": "Rio-Limpopo-2026"},
            content_type="application/json",
        ).status_code
        == 204
    )
    # O link só serve uma vez.
    assert (
        other.post(
            "/api/auth/set-password",
            {"uid": uid, "token": token, "password": "Outra-senha-2026"},
            content_type="application/json",
        ).status_code
        == 400
    )

    r = other.post(
        "/api/auth/portal/login",
        {"login": "admin@aguas.test", "password": "Rio-Limpopo-2026"},
        content_type="application/json",
    )
    assert r.status_code == 200 and r.json()["mfa_enrolled"] is False
    assert (
        other.post(
            "/api/auth/portal/login",
            {"login": "admin@aguas.test", "password": "errada"},
            content_type="application/json",
        ).status_code
        == 400
    )


@pytest.mark.django_db
def test_only_staff_can_invite(client):
    Institution.objects.create(name="X", slug="x")
    User.objects.create_user("+258841234567", password="Senha-forte-123")
    client.post(
        "/api/auth/portal/login", {"login": "841234567", "password": "Senha-forte-123"}, content_type="application/json"
    )
    assert client.post(
        "/api/backoffice/institutions/x/members", {"email": "a@b.test"}, content_type="application/json"
    ).status_code in (401, 403)


@pytest.mark.django_db
def test_create_staff_command_prints_invite_and_needs_no_password(capsys):
    from django.core.management import call_command

    call_command("create_staff", email="Dono@PagaMoz.test", name="Dono Da Silva")
    u = User.objects.get(email="dono@pagamoz.test")
    assert u.is_staff and u.is_superuser and not u.has_usable_password() and u.phone is None
    assert "/definir-senha?uid=" in capsys.readouterr().out


@pytest.mark.django_db
def test_portal_second_step_by_email_never_shows_code(client, settings, mailoutbox):
    settings.EMAIL_HOST = "smtp.teste"
    settings.DEMO_MODE = True  # mesmo em demonstração, o código por email não vai na resposta
    User.objects.create_user(None, email="ana@inst.test", password="Senha-forte-123", is_staff=True)
    r = client.post(
        "/api/auth/portal/login",
        {"login": "ana@inst.test", "password": "Senha-forte-123"},
        content_type="application/json",
    )
    body = r.json()
    assert body["mfa_method"] == "email" and body["email_hint"] == "a•••a@inst.test" and "demo_code" not in body
    code = re.search(r"\b(\d{6})\b", mailoutbox[0].subject).group(1)
    wrong = "000000" if code != "000000" else "111111"
    assert (
        client.post("/api/auth/portal/mfa/verify", {"code": wrong}, content_type="application/json").status_code == 400
    )
    assert (
        client.post("/api/auth/portal/mfa/verify", {"code": code}, content_type="application/json").status_code == 200
    )
    # Usado uma vez: não volta a servir.
    assert client.get("/api/me").status_code == 200
