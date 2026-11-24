"""Entrar com Google (OAuth 2.0 / OpenID Connect, fluxo "authorization code").

Endpoints oficiais documentados pela Google:
  https://accounts.google.com/o/oauth2/v2/auth · https://oauth2.googleapis.com/token
Configuração: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (Google Cloud Console → Credenciais → OAuth client "Web")
e o URI de redireccionamento  {PUBLIC_WEB_URL}/api/auth/google/callback  registado nessa credencial.

Regras:
- Só entra quem já tem conta com esse email (verificado pela Google). Não cria contas: a identidade do
  cidadão é o telefone, e a equipa de uma instituição é criada pelo administrador.
- No portal, a Google substitui só a palavra-passe: o MFA continua obrigatório.
"""

import base64
import json
import secrets
import time
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth import login
from django.http import HttpResponseRedirect, JsonResponse

from audit.models import record

from .models import User

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
FLOWS = {"portal": "/portal", "cidadao": "/entrar"}


def enabled() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def redirect_uri() -> str:
    return f"{settings.PUBLIC_WEB_URL.rstrip('/')}/api/auth/google/callback"


def _safe_next(v: str | None, default: str) -> str:
    return v if v and v.startswith("/") and not v.startswith("//") else default


def status(request):
    return JsonResponse({"enabled": enabled()})


def start(request):
    flow = request.GET.get("flow", "cidadao")
    if flow not in FLOWS:
        return JsonResponse({"detail": "Fluxo inválido."}, status=400)
    if not enabled():
        return JsonResponse({"detail": "Entrar com Google ainda não está configurado neste ambiente."}, status=503)
    state, nonce = secrets.token_urlsafe(24), secrets.token_urlsafe(24)
    request.session["google_oauth"] = {
        "state": state,
        "nonce": nonce,
        "flow": flow,
        "next": _safe_next(request.GET.get("next"), "/conta"),
        "at": time.time(),
    }
    q = urllib.parse.urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID, "redirect_uri": redirect_uri(), "response_type": "code",
        "scope": "openid email profile", "state": state, "nonce": nonce, "prompt": "select_account",
    })  # fmt: skip
    return HttpResponseRedirect(f"{AUTH_URL}?{q}")


def exchange_code(code: str) -> dict:
    """Troca o código pelo id_token (servidor→Google por TLS). Isolado para os testes."""
    body = urllib.parse.urlencode({
        "code": code, "client_id": settings.GOOGLE_CLIENT_ID, "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri(), "grant_type": "authorization_code",
    }).encode()  # fmt: skip
    req = urllib.request.Request(TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def _claims(id_token: str) -> dict:
    # O id_token veio directamente do endpoint de token da Google por TLS, autenticado com o client_secret:
    # o OIDC Core (3.1.3.7) permite validar pelo canal TLS em vez da assinatura. Validamos as restantes regras.
    payload = id_token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))


def callback(request):
    saved = request.session.pop("google_oauth", None)
    flow_page = FLOWS.get((saved or {}).get("flow", "cidadao"), "/entrar")

    def fail(code: str):
        return HttpResponseRedirect(f"{flow_page}?erro={code}")

    if not saved or request.GET.get("state") != saved["state"] or time.time() - saved["at"] > 600:
        return fail("google_estado")
    if request.GET.get("error") or not request.GET.get("code"):
        return fail("google_cancelado")
    try:
        tokens = exchange_code(request.GET["code"])
        c = _claims(tokens["id_token"])
    except Exception:  # rede, resposta inválida, token mal formado
        return fail("google_falhou")
    if (c.get("aud") != settings.GOOGLE_CLIENT_ID or c.get("iss") not in ISSUERS or c.get("exp", 0) < time.time()
            or c.get("nonce") != saved["nonce"] or not c.get("email_verified")):  # fmt: skip
        return fail("google_invalido")

    user = User.objects.filter(email__iexact=c["email"], is_active=True).first()
    if user is None:
        record("auth.google_sem_conta", request=request, email_domain=c["email"].split("@")[-1])
        return fail("google_sem_conta")

    if saved["flow"] == "portal":
        if not (user.memberships.exists() or user.is_staff):
            return fail("google_sem_acesso")
        request.session.cycle_key()
        request.session["pre_mfa_user"] = user.pk  # o MFA continua obrigatório
        record("auth.google_portal_step1", request=request, actor=user)
        return HttpResponseRedirect("/portal?google=1")

    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    record("auth.google_login", request=request, actor=user)
    return HttpResponseRedirect(saved["next"])
