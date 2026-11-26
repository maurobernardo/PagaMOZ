import base64
import io
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from PIL import Image, ImageOps
from rest_framework import generics, permissions, serializers, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from audit.models import record
from catalog.api import MembershipSerializer, ServicePublicSerializer, _public_services
from payments.api import PaymentSerializer
from payments.models import Transaction
from servicerequests.api import RequestPublicSerializer
from servicerequests.models import ServiceRequest

from .models import OtpChallenge, SavedObligation, User, phone_validator

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
        phone = normalize_phone(super().to_internal_value(data))
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
    phone = PhoneField()
    password = serializers.CharField(max_length=128)


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
        "mfa_enrolled": serializers.BooleanField(), "demo_code": serializers.CharField(required=False)}))  # fmt: skip
    def post(self, request):
        from django.contrib.auth import authenticate
        from django.core.cache import cache

        s = PortalLogin(data=request.data)
        s.is_valid(raise_exception=True)
        phone = s.validated_data["phone"]
        key = f"portal-login-fail:{phone}"
        if cache.get(key, 0) >= LOCK_AFTER:
            return Response({"detail": "Conta bloqueada temporariamente por tentativas falhadas. Tente em 15 minutos."},
                            status=429)  # fmt: skip
        user = authenticate(request, phone=phone, password=s.validated_data["password"])
        if user is None or not (user.memberships.exists() or user.is_staff):
            cache.set(key, cache.get(key, 0) + 1, LOCK_SECONDS)
            record("auth.portal_login_failed", request=request, phone=phone)
            return Response({"detail": "Telefone ou palavra-passe incorrectos."}, status=400)
        cache.delete(key)
        request.session.cycle_key()
        request.session["pre_mfa_user"] = user.pk
        return Response({"mfa_enrolled": user.mfa_enabled, **_demo_code(user)})


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
            {"secret": user.mfa_secret, "otpauth_uri": uri(user.mfa_secret, user.phone), **_demo_code(user)}
        )


class MfaVerifyView(APIView):
    """Passo 2: código TOTP. Na primeira vez também activa o MFA."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [OtpThrottle]

    @extend_schema(request=MfaCode, responses=inline_serializer("PortalSession", {
        "phone": serializers.CharField(), "is_staff": serializers.BooleanField(),
        "memberships": MembershipSerializer(many=True)}))  # fmt: skip
    def post(self, request):
        from .totp import verify

        user = _pre_mfa_user(request)
        if user is None or not user.mfa_secret:
            return Response({"detail": "Entre primeiro com a palavra-passe."}, status=401)
        s = MfaCode(data=request.data)
        s.is_valid(raise_exception=True)
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
        return Response({"phone": user.phone, "is_staff": user.is_staff, "memberships": memberships})


class PortalPendingView(APIView):
    """Depois de "Entrar com Google" no portal: falta o passo MFA."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=inline_serializer("PortalPending", {
        "mfa_enrolled": serializers.BooleanField(), "demo_code": serializers.CharField(required=False)}))  # fmt: skip
    def get(self, request):
        user = _pre_mfa_user(request)
        if user is None:
            return Response({"detail": "Sessão expirada. Entre de novo."}, status=401)
        return Response({"mfa_enrolled": user.mfa_enabled, **_demo_code(user)})


class CsrfView(APIView):
    """Para a app móvel: devolve o token CSRF (também fica no cookie)."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=inline_serializer("Csrf", {"csrf": serializers.CharField()}))
    def get(self, request):
        return Response({"csrf": get_token(request)})


class AvatarView(APIView):
    """POST multipart `avatar` (JPG/PNG/WebP até 5 MB) guarda a foto de perfil; DELETE remove-a."""

    parser_classes = [MultiPartParser]

    @extend_schema(
        request={
            "multipart/form-data": {"type": "object", "properties": {"avatar": {"type": "string", "format": "binary"}}}
        },
        responses=inline_serializer("Avatar", {"avatar": serializers.CharField()}),
    )
    def post(self, request):
        f = request.FILES.get("avatar")
        if f is None or f.size > 5 * 1024 * 1024:
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
