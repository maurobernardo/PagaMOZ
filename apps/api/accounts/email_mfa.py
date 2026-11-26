"""Segundo passo do portal por email: um código de 6 dígitos enviado para o email da pessoa.

Nunca aparece no ecrã (nem em modo demonstração). Fica só o hash na sessão, vale 10 minutos e aceita
5 tentativas. Só é usado quando há SMTP configurado (EMAIL_HOST); sem isso o portal usa a app autenticadora.
"""

import hashlib
import hmac
import secrets
import time

from django.conf import settings
from django.core.mail import send_mail

TTL = 10 * 60
MAX_TRIES = 5
KEY = "email_mfa"


def available(user) -> bool:
    return bool(settings.EMAIL_HOST and user.email)


def _hash(code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"mfa:{code}".encode(), hashlib.sha256).hexdigest()


def hint(email: str) -> str:
    """maria.silva@gmail.com -> m•••a@gmail.com"""
    name, _, domain = email.partition("@")
    return f"{name[0]}•••{name[-1] if len(name) > 1 else ''}@{domain}"


def start(request, user) -> dict:
    """Gera e envia um código novo. Devolve o que o ecrã precisa de mostrar (sem o código)."""
    code = f"{secrets.randbelow(10**6):06d}"
    request.session[KEY] = {"user": user.pk, "hash": _hash(code), "exp": time.time() + TTL, "tries": 0}
    send_mail(
        f"PagaMOZ: o seu código é {code}",
        f"O seu código para entrar no portal PagaMOZ é:\n\n{code}\n\n"
        "Vale 10 minutos. Se não foi você a tentar entrar, ignore este email e mude a sua senha.",
        None,
        [user.email],
    )
    return {"mfa_method": "email", "email_hint": hint(user.email)}


def check(request, user, code: str) -> bool | None:
    """True: certo. False: errado (conta a tentativa). None: não há código pendente para esta pessoa."""
    s = request.session.get(KEY)
    if not s or s.get("user") != user.pk:
        return None
    if time.time() > s["exp"] or s["tries"] >= MAX_TRIES:
        request.session.pop(KEY, None)
        return False
    if hmac.compare_digest(s["hash"], _hash(code)):
        request.session.pop(KEY, None)
        return True
    s["tries"] += 1
    request.session[KEY] = s
    return False
