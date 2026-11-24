from datetime import timedelta

from django.conf import settings
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers, viewsets
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from audit.models import record
from catalog.api import ServicePublicSerializer, _public_services
from payments.api import PaymentSerializer
from payments.models import Transaction
from servicerequests.api import RequestPublicSerializer
from servicerequests.models import ServiceRequest

from .models import OtpChallenge, SavedObligation, User, phone_validator

MAX_OTP_PER_HOUR = 5


class OtpThrottle(AnonRateThrottle):
    scope = "otp"  # contador próprio; com o scope "anon" herdado partilharia o histórico do limite geral
    rate = "10/min"


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
