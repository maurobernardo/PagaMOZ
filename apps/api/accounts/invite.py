"""Convites: quem é criado por outra pessoa (super admin, administrador da instituição) define a própria senha.

Ninguém escolhe nem vê a senha de outro. O convite é um link de uso único com o gerador de tokens do
Django (deixa de valer quando a senha muda ou ao fim de PASSWORD_RESET_TIMEOUT). O mesmo serve para
"esqueci-me da senha".
Se houver SMTP configurado (EMAIL_HOST), o link vai também por email; senão quem convidou envia-o.
"""

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from audit.models import record

from .models import User


def invite_link(user: User) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.PUBLIC_WEB_URL.rstrip('/')}/definir-senha?uid={uid}&token={token}"


def send_invite(user: User, institution_name: str = "") -> bool:
    """Envia o link por email se houver SMTP. Devolve True se enviou."""
    if not (settings.EMAIL_HOST and user.email):
        return False
    where = f" no portal de {institution_name}" if institution_name else " no PagaMOZ"
    try:
        send_mail(
            "PagaMOZ: defina a sua senha",
            f"Olá{(' ' + user.first_name) if user.first_name else ''},\n\n"
            f"Foi criada uma conta para si{where}. Defina a sua senha neste link (válido por 3 dias):\n\n"
            f"{invite_link(user)}\n\nSe não esperava este email, ignore-o.",
            None,
            [user.email],
        )
    except OSError:
        return False
    return True


def _user_from(uid: str, token: str) -> User | None:
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
    return user if default_token_generator.check_token(user, token) else None


class SetPassword(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(max_length=128, write_only=True)


class SetPasswordThrottle(AnonRateThrottle):
    rate = "20/hour"


class SetPasswordView(APIView):
    """GET ?uid&token: o link ainda vale? POST: define a senha (e o link deixa de valer)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [SetPasswordThrottle]

    @extend_schema(
        responses=inline_serializer("InviteInfo", {"email": serializers.CharField(), "name": serializers.CharField()})
    )
    def get(self, request):
        user = _user_from(request.query_params.get("uid", ""), request.query_params.get("token", ""))
        if not user:
            return Response({"detail": "Este link já não é válido. Peça um novo a quem o convidou."}, status=400)
        return Response({"email": user.email, "name": user.get_full_name()})

    @extend_schema(request=SetPassword, responses={204: None})
    def post(self, request):
        s = SetPassword(data=request.data)
        s.is_valid(raise_exception=True)
        user = _user_from(s.validated_data["uid"], s.validated_data["token"])
        if not user:
            return Response({"detail": "Este link já não é válido. Peça um novo a quem o convidou."}, status=400)
        try:
            validate_password(s.validated_data["password"], user)
        except Exception as e:  # ValidationError do Django: devolve as mensagens em português
            return Response({"password": list(getattr(e, "messages", [str(e)]))}, status=400)
        user.set_password(s.validated_data["password"])
        user.save(update_fields=["password"])
        record("auth.password_set", request=request, target=user)
        return Response(status=204)
