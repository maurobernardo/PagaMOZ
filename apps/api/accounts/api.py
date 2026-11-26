import base64
import io
import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from PIL import Image, ImageOps
from rest_framework import generics, permissions, serializers, viewsets
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from audit.models import record
from catalog.api import MembershipSerializer, ServicePublicSerializer, _public_services
from payments.api import PaymentSerializer
from payments.models import Transaction
from servicerequests.api import RequestPublicSerializer
from servicerequests.models import ServiceRequest

from .models import OtpChallenge, PushDevice, SavedObligation, User, phone_validator

MAX_OTP_PER_HOUR = 5


class OtpThrottle(AnonRateThrottle):
    scope = "otp"  # contador próprio; com o scope "anon" herdado partilharia o histórico do limite geral


def normalize_phone(raw: str) -> str:
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 9:
        digits = "258" + digits
    return "+" + digits


class PhoneField(serializers.CharField):
    def to_internal_value(self, data):
        raw = super().to_internal_value(data)
        if not raw:
            return ""
        phone = normalize_phone(raw)
        phone_validator(phone)
        return phone


class OtpRequest(serializers.Serializer):
    phone = PhoneField()


class OtpVerify(serializers.Serializer):
    phone = PhoneField()
    code = serializers.RegexField(r"^\d{6}$")


class OtpRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpThrottle]

    @extend_schema(request=OtpRequest, responses=inline_serializer("OtpSent", {
        "phone": serializers.CharField(), "expires_in": serializers.IntegerField(),
        "demo_code": serializers.CharField(required=False)}))  # fmt: skip
    def post(self, request):
        s = OtpRequest(data=request.data)
        s.is_valid(raise_exception=True)
        phone = s.validated_data["phone"]
        recent = OtpChallenge.objects.filter(phone=phone, created_at__gte=timezone.now() - timedelta(hours=1))
        if recent.count() >= MAX_OTP_PER_HOUR:
            return Response({"detail": "Demasiados pedidos de código. Tente mais tarde."}, status=429)
        _, code = OtpChallenge.issue(phone)
        body = {"phone": phone, "expires_in": int(OtpChallenge.TTL.total_seconds())}
        if settings.DEMO_MODE:
            body["demo_code"] = code  # ponytail: sem gateway SMS; em produção sai por SMS e nunca na resposta
        return Response(body, status=201)


class OtpVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpThrottle]

    @extend_schema(request=OtpVerify, responses=inline_serializer("Session", {"phone": serializers.CharField()}))
    def post(self, request):
        s = OtpVerify(data=request.data)
        s.is_valid(raise_exception=True)
        phone, code = s.validated_data["phone"], s.validated_data["code"]
        ch = OtpChallenge.objects.filter(phone=phone, used_at__isnull=True).order_by("-created_at").first()
        if ch is None or not ch.verify_code(code):
            return Response({"detail": "Código inválido ou expirado."}, status=400)
        user = User.objects.filter(phone=phone).first() or User.objects.create_user(phone)
        if not user.is_active:
            return Response({"detail": "Conta desactivada."}, status=403)
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        record("auth.otp_login", request=request, actor=user)
        get_token(request)
        return Response({"phone": user.phone})


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=204)


# ---------- Área do cidadão ----------


class ObligationSerializer(serializers.ModelSerializer):
    service = serializers.PrimaryKeyRelatedField(queryset=_public_services())
    service_detail = ServicePublicSerializer(source="service", read_only=True)

    class Meta:
        model = SavedObligation
        fields = ["id", "label", "service", "service_detail", "fields", "created_at"]

    def validate(self, attrs):
        from payments.domain import PaymentError, validate_fields

        service = attrs.get("service") or self.instance.service
        try:
            attrs["fields"] = validate_fields(service, attrs.get("fields", {}))
        except PaymentError as e:
            raise serializers.ValidationError({"fields": e.args[0]}) from e
        return attrs


class ObligationViewSet(viewsets.ModelViewSet):
    serializer_class = ObligationSerializer
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SavedObligation.objects.none()
        return SavedObligation.objects.filter(user=self.request.user).select_related("service__institution",
                                                                                     "service__category")  # fmt: skip

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MyPayments(generics.ListAPIView):
    serializer_class = PaymentSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Transaction.objects.none()
        return Transaction.objects.filter(user=self.request.user).select_related("service", "institution")


class MyRequests(generics.ListAPIView):
    serializer_class = RequestPublicSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ServiceRequest.objects.none()
        return (ServiceRequest.objects.filter(user=self.request.user)
                .select_related("service", "institution").prefetch_related("events"))  # fmt: skip


# ---------- Portal: palavra-passe + MFA (TOTP) ----------

LOCK_AFTER = 5
LOCK_SECONDS = 15 * 60


class PortalLogin(serializers.Serializer):
    """Email ou telefone (o campo antigo "phone" continua a ser aceite)."""

    login = serializers.CharField(max_length=254, required=False)
    phone = serializers.CharField(max_length=20, required=False)
    password = serializers.CharField(max_length=128)

    def validate(self, d):
        raw = (d.get("login") or d.get("phone") or "").strip()
        if not raw:
            raise serializers.ValidationError({"login": "Escreva o email ou o telefone."})
        d["login"] = raw.lower() if "@" in raw else normalize_phone(raw)
        return d


def find_staff_user(login_id: str) -> User | None:
    if "@" in login_id:
        return User.objects.filter(email__iexact=login_id, is_active=True).first()
    return User.objects.filter(phone=login_id, is_active=True).first()


class MfaCode(serializers.Serializer):
    code = serializers.RegexField(r"^\d{6}$")


def _demo_code(user):
    from .totp import now_code

    return {"demo_code": now_code(user.mfa_secret)} if settings.DEMO_MODE and user.mfa_secret else {}


class PortalLoginView(APIView):
    """Passo 1: telefone + palavra-passe. Não abre sessão completa: fica à espera do MFA."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpThrottle]

    @extend_schema(request=PortalLogin, responses=inline_serializer("PortalLoginStep", {
        "mfa_enrolled": serializers.BooleanField(), "mfa_method": serializers.CharField(),
        "email_hint": serializers.CharField(required=False),
        "demo_code": serializers.CharField(required=False)}))  # fmt: skip
    def post(self, request):
        from django.core.cache import cache

        s = PortalLogin(data=request.data)
        s.is_valid(raise_exception=True)
        login_id = s.validated_data["login"]
        key = f"portal-login-fail:{login_id}"
        if cache.get(key, 0) >= LOCK_AFTER:
            return Response({"detail": "Conta bloqueada temporariamente por tentativas falhadas. Tente em 15 minutos."},
                            status=429)  # fmt: skip
        user = find_staff_user(login_id)
        if (
            user is None
            or not user.check_password(s.validated_data["password"])
            or not (user.memberships.exists() or user.is_staff)
        ):
            cache.set(key, cache.get(key, 0) + 1, LOCK_SECONDS)
            record("auth.portal_login_failed", request=request, login=login_id)
            return Response({"detail": "Email/telefone ou senha incorrectos."}, status=400)
        cache.delete(key)
        request.session.cycle_key()
        request.session["pre_mfa_user"] = user.pk
        return Response(_second_step(request, user))


def _second_step(request, user) -> dict:
    """Código por email quando há SMTP; senão a app autenticadora (como antes)."""
    from . import email_mfa

    if email_mfa.available(user):
        try:
            return {"mfa_enrolled": True, **email_mfa.start(request, user)}
        except OSError:
            pass  # SMTP em baixo: segue para a app autenticadora
    return {"mfa_enrolled": user.mfa_enabled, "mfa_method": "totp", **_demo_code(user)}


class MfaEmailResendView(APIView):
    """Envia um código novo por email (o anterior deixa de valer)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpThrottle]

    @extend_schema(request=None, responses=inline_serializer("MfaEmail", {
        "mfa_method": serializers.CharField(), "email_hint": serializers.CharField()}))  # fmt: skip
    def post(self, request):
        from . import email_mfa

        user = _pre_mfa_user(request)
        if user is None or not email_mfa.available(user):
            return Response({"detail": "Entre primeiro com a senha."}, status=401)
        try:
            return Response(email_mfa.start(request, user))
        except OSError:
            return Response({"detail": "Não foi possível enviar o email. Tente daqui a pouco."}, status=503)


def _pre_mfa_user(request):
    pk = request.session.get("pre_mfa_user")
    return User.objects.filter(pk=pk, is_active=True).first() if pk else None


class MfaSetupView(APIView):
    """Primeiro acesso: gera segredo e URI otpauth para a app autenticadora."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(request=None, responses=inline_serializer("MfaSetup", {
        "secret": serializers.CharField(), "otpauth_uri": serializers.CharField(),
        "demo_code": serializers.CharField(required=False)}))  # fmt: skip
    def post(self, request):
        from .totp import new_secret, uri

        user = _pre_mfa_user(request)
        if user is None:
            return Response({"detail": "Entre primeiro com a palavra-passe."}, status=401)
        if user.mfa_enabled:
            return Response({"detail": "MFA já configurado."}, status=409)
        user.mfa_secret = new_secret()
        user.save(update_fields=["mfa_secret"])
        return Response(
            {
                "secret": user.mfa_secret,
                "otpauth_uri": uri(user.mfa_secret, user.email or user.phone),
                **_demo_code(user),
            }
        )


class MfaVerifyView(APIView):
    """Passo 2: código TOTP. Na primeira vez também activa o MFA."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpThrottle]

    @extend_schema(request=MfaCode, responses=inline_serializer("PortalSession", {
        "phone": serializers.CharField(), "email": serializers.CharField(), "is_staff": serializers.BooleanField(),
        "memberships": MembershipSerializer(many=True)}))  # fmt: skip
    def post(self, request):
        from .totp import verify

        user = _pre_mfa_user(request)
        if user is None:
            return Response({"detail": "Entre primeiro com a senha."}, status=401)
        s = MfaCode(data=request.data)
        s.is_valid(raise_exception=True)
        from . import email_mfa

        by_email = email_mfa.check(request, user, s.validated_data["code"])
        if by_email is False:
            record("auth.mfa_failed", actor=user, request=request, via="email")
            return Response({"detail": "Código errado ou expirado. Peça um novo."}, status=400)
        if by_email is None:
            if not user.mfa_secret:
                return Response({"detail": "Entre primeiro com a senha."}, status=401)
            counter = verify(user.mfa_secret, s.validated_data["code"])
            if counter is None or counter <= user.mfa_last_counter:
                record("auth.mfa_failed", actor=user, request=request)
                return Response({"detail": "Código inválido ou já usado."}, status=400)
            User.objects.filter(pk=user.pk).update(mfa_last_counter=counter, mfa_enabled=True)
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        request.session.pop("pre_mfa_user", None)
        request.session["mfa_ok"] = True
        record("auth.portal_login", actor=user, request=request)
        get_token(request)
        memberships = MembershipSerializer(user.memberships.select_related("institution"), many=True).data
        return Response(
            {"phone": user.phone or "", "email": user.email, "is_staff": user.is_staff, "memberships": memberships}
        )


class PortalPendingView(APIView):
    """Depois de "Entrar com Google" no portal: falta o passo MFA."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=inline_serializer("PortalPending", {
        "mfa_enrolled": serializers.BooleanField(), "mfa_method": serializers.CharField(),
        "email_hint": serializers.CharField(required=False),
        "demo_code": serializers.CharField(required=False)}))  # fmt: skip
    def get(self, request):
        user = _pre_mfa_user(request)
        if user is None:
            return Response({"detail": "Sessão expirada. Entre de novo."}, status=401)
        return Response(_second_step(request, user))


class CsrfView(APIView):
    """Para a app móvel: devolve o token CSRF (também fica no cookie)."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=inline_serializer("Csrf", {"csrf": serializers.CharField()}))
    def get(self, request):
        return Response({"csrf": get_token(request)})


class AvatarView(APIView):
    """POST multipart `avatar` (JPG/PNG/WebP até 5 MB) guarda a foto de perfil; DELETE remove-a."""

    parser_classes = [
        MultiPartParser,
        JSONParser,
    ]  # JSON {"base64": ...}: a app envia assim (multipart falha em alguns telemóveis)

    @extend_schema(
        request={
            "multipart/form-data": {"type": "object", "properties": {"avatar": {"type": "string", "format": "binary"}}}
        },
        responses=inline_serializer("Avatar", {"avatar": serializers.CharField()}),
    )
    def post(self, request):
        f = request.FILES.get("avatar")
        size = f.size if f else 0
        if f is None and isinstance(request.data.get("base64"), str):
            try:
                raw = base64.b64decode(request.data["base64"].split(",")[-1], validate=True)
            except ValueError:
                return Response({"detail": "Esta imagem não pode ser lida."}, status=400)
            f, size = io.BytesIO(raw), len(raw)
        if f is None or size > 5 * 1024 * 1024:
            return Response({"detail": "Escolha uma imagem até 5 MB."}, status=400)
        try:
            request.user.avatar = avatar_data_url(f)
        except (OSError, ValueError, Image.DecompressionBombError):
            return Response({"detail": "Esta imagem não pode ser lida."}, status=400)
        request.user.save(update_fields=["avatar"])
        return Response({"avatar": request.user.avatar})

    @extend_schema(responses={204: None})
    def delete(self, request):
        request.user.avatar = ""
        request.user.save(update_fields=["avatar"])
        return Response(status=204)


def avatar_data_url(f) -> str:
    """Abre (só imagens reais), corta ao centro em quadrado, reduz a 256 px e devolve WebP em data URL."""
    im = Image.open(f)
    if im.format not in ("JPEG", "PNG", "WEBP", "MPO", "HEIF"):
        raise ValueError("formato")
    im = ImageOps.exif_transpose(im).convert("RGB")
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width + side) // 2, (im.height + side) // 2))
    im = im.resize((256, 256), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=80)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


class PushTokenView(APIView):
    """Regista (ou esquece, com DELETE) o token push da Expo deste telemóvel."""

    @extend_schema(
        request=inline_serializer(
            "PushToken", {"token": serializers.CharField(), "platform": serializers.CharField(required=False)}
        ),
        responses={204: None},
    )
    def post(self, request):
        token = str(request.data.get("token", ""))
        if not re.fullmatch(r"Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]", token):
            return Response({"detail": "Token inválido."}, status=400)
        PushDevice.objects.update_or_create(
            token=token, defaults={"user": request.user, "platform": str(request.data.get("platform", ""))[:10]}
        )
        return Response(status=204)

    @extend_schema(
        request=inline_serializer("PushTokenDelete", {"token": serializers.CharField()}), responses={204: None}
    )
    def delete(self, request):
        PushDevice.objects.filter(user=request.user, token=str(request.data.get("token", ""))).delete()
        return Response(status=204)
