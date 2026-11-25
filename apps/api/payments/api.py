import hashlib
import hmac
import json

from django.conf import settings
from django.db import IntegrityError
from django.db import transaction as db
from django.db.models import Sum
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from catalog.models import Service
from institutions.permissions import InstitutionRole, resolve_membership
from ledger.models import Account, balance
from settlement.models import SettlementBatch

from .domain import PaymentError, price, resolve_source, transition
from .models import Method, Status, Transaction
from .providers import INSTRUCTIONS, SCENARIOS, InvalidSignature, get_provider
from .webhooks import process_webhook

# ---------- Serializers ----------


FORBIDDEN_CARD_KEYS = {"number", "card_number", "pan", "cvv", "cvc", "cvv2", "security_code"}


class CardSummary(serializers.Serializer):
    """O que o browser envia depois de tokenizar: nunca o número completo nem o CVV."""

    token = serializers.RegexField(r"^tok_[A-Za-z0-9]{16,40}$")
    brand = serializers.ChoiceField(["visa", "mastercard"])
    last4 = serializers.RegexField(r"^\d{4}$")
    exp_month = serializers.IntegerField(min_value=1, max_value=12)
    exp_year = serializers.IntegerField(min_value=2000, max_value=2100)
    holder = serializers.CharField(max_length=60)

    def to_internal_value(self, data):
        if isinstance(data, dict) and FORBIDDEN_CARD_KEYS & {str(k).lower() for k in data}:
            raise serializers.ValidationError("O número completo do cartão e o CVV nunca são enviados ao servidor.")
        return super().to_internal_value(data)

    def validate(self, attrs):
        from datetime import date

        today = date.today()
        if (attrs["exp_year"], attrs["exp_month"]) < (today.year, today.month):
            raise serializers.ValidationError("Cartão expirado.")
        return attrs


class PaymentCreateSerializer(serializers.Serializer):
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.filter(is_active=True))
    fields = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False, default=dict)
    amount = serializers.IntegerField(required=False, min_value=1, help_text="Centavos (serviços de valor aberto).")
    method = serializers.ChoiceField(Method.choices)
    payer_phone = serializers.RegexField(r"^\+258[28]\d{8}$", required=False, allow_blank=True)
    scenario = serializers.ChoiceField(list(SCENARIOS), required=False, help_text="Só em ambiente de demonstração.")
    quote = serializers.CharField(required=False, help_text="Obrigatório em serviços de valor por consulta.")
    request = serializers.CharField(required=False, help_text="Código do pedido (serviços de nível 3).")
    card = CardSummary(required=False)

    def validate(self, attrs):
        if attrs["method"] == Method.CARD and not attrs.get("card"):
            raise serializers.ValidationError({"card": "Indique os dados do cartão."})
        return attrs


class DeliverySerializer(serializers.Serializer):
    titulo = serializers.CharField(required=False)
    codigo = serializers.CharField(required=False)
    instrucao = serializers.CharField(required=False, allow_blank=True)


class PaymentSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name")
    institution_name = serializers.CharField(source="institution.name")
    instructions = serializers.SerializerMethodField()
    receipt_code = serializers.SerializerMethodField()
    next_action = serializers.SerializerMethodField(help_text='"3ds" quando o banco pede autenticação do cartão.')
    delivery = DeliverySerializer(read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "reference", "status", "service", "service_name", "institution_name", "description",
            "amount", "commission", "commission_payer", "total", "institution_net", "currency",
            "method", "card_brand", "card_last4", "next_action", "instructions", "receipt_code", "delivery",
            "failure_reason",
            "created_at", "expires_at", "confirmed_at", "settled_at",
        ]  # fmt: skip
        read_only_fields = fields

    def get_next_action(self, obj) -> str | None:
        return "3ds" if obj.three_ds_hash and obj.status == Status.PENDING else None

    def get_receipt_code(self, obj) -> str | None:
        r = getattr(obj, "receipt", None)  # OneToOne inverso: ausente -> None
        return r.display_code if r else None

    def get_instructions(self, obj) -> str:
        return INSTRUCTIONS[obj.method] if obj.status in (Status.CREATED, Status.PENDING) else ""


class SettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = SettlementBatch
        fields = ["id", "business_date", "count", "gross", "commission", "net", "destination", "provider", "created_at"]
        read_only_fields = fields


# ---------- Cidadão ----------


def _hash(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


class PaymentCreate(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=PaymentCreateSerializer,
        responses={201: PaymentSerializer, 200: PaymentSerializer},
        parameters=[OpenApiParameter("Idempotency-Key", str, OpenApiParameter.HEADER, required=True)],
    )
    def post(self, request):
        key = request.headers.get("Idempotency-Key", "").strip()
        if not 8 <= len(key) <= 80:
            return Response({"detail": "Cabeçalho Idempotency-Key obrigatório (8–80 caracteres)."}, status=400)
        req_hash = _hash(request.data)
        if (existing := Transaction.objects.filter(idempotency_key=key).first()) is not None:
            return self._replay(existing, req_hash)

        s = PaymentCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        service = d["service"]
        if d.get("scenario") and not settings.DEMO_MODE:
            return Response({"scenario": "Indisponível fora do ambiente de demonstração."}, status=400)
        try:
            with db.atomic():
                src = resolve_source(service, d)
                amount = src.pop("amount")
                txn = Transaction.objects.create(
                    service=service, institution=service.institution,
                    user=request.user if request.user.is_authenticated else None,
                    payer_phone=d.get("payer_phone", ""), method=d["method"],
                    demo_scenario=d.get("scenario", ""), idempotency_key=key, request_hash=req_hash,
                    **src, **price(service, amount),
                )  # fmt: skip
                init = get_provider(txn.method).initiate(txn)
                extra = {}
                if init.challenge_code:
                    card = d["card"]
                    extra = {
                        "three_ds_hash": three_ds_hash(txn.reference, init.challenge_code),
                        "card_brand": card["brand"],
                        "card_last4": card["last4"],
                    }
                transition(txn.pk, Status.PENDING, provider_ref=init.provider_ref, **extra)
        except PaymentError as e:
            return Response({"detail": e.args[0]} if isinstance(e.args[0], str) else {"fields": e.args[0]}, 400)
        except IntegrityError:  # corrida com o mesmo Idempotency-Key
            return self._replay(Transaction.objects.get(idempotency_key=key), req_hash)
        txn.refresh_from_db()
        body = PaymentSerializer(txn).data
        if init.challenge_code and settings.DEMO_MODE:
            body["demo_3ds_code"] = init.challenge_code  # demo: sem banco emissor real a enviar SMS
        return Response(body, status=201)

    def _replay(self, txn, req_hash):
        if txn.request_hash != req_hash:
            return Response({"detail": "Idempotency-Key já usada com outro pedido."}, status=409)
        return Response(PaymentSerializer(txn).data, status=200, headers={"Idempotent-Replay": "true"})


class PaymentDetail(generics.RetrieveAPIView):
    """A referência (~50 bits aleatórios) funciona como capacidade de leitura do estado."""

    permission_classes = [permissions.AllowAny]
    serializer_class = PaymentSerializer
    lookup_field = "reference"
    queryset = Transaction.objects.select_related("service", "institution")


class Scenarios(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses=inline_serializer(
            "Scenarios",
            {
                "demo_mode": serializers.BooleanField(),
                "scenarios": serializers.DictField(child=serializers.CharField()),
            },
        )
    )
    def get(self, request):
        return Response({"demo_mode": settings.DEMO_MODE, "scenarios": SCENARIOS if settings.DEMO_MODE else {}})


class Webhook(APIView):
    authentication_classes: list = []  # autenticado por HMAC, não por sessão (sem CSRF)
    permission_classes = [permissions.AllowAny]
    throttle_classes: list = []

    @extend_schema(request=None, responses=inline_serializer("WebhookAck", {"outcome": serializers.CharField()}))
    def post(self, request, method):
        if method not in Method.values:
            return Response(status=404)
        try:
            outcome = process_webhook(method, request.body, request.headers.get("X-Signature", ""))
        except InvalidSignature:
            return Response({"outcome": "assinatura_invalida"}, status=401)
        except (ValueError, KeyError):
            return Response({"outcome": "payload_invalido"}, status=400)
        return Response({"outcome": outcome}, status=status.HTTP_200_OK)


# ---------- Portal da instituição ----------


class PortalSettlements(generics.ListAPIView):
    serializer_class = SettlementSerializer
    permission_classes = [permissions.IsAuthenticated, InstitutionRole]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SettlementBatch.objects.none()
        inst = resolve_membership(self.request, self.kwargs["institution_slug"]).institution
        return SettlementBatch.objects.filter(institution=inst)


class PortalBalances(APIView):
    """O dinheiro da instituição: a liquidar (confirmado, ainda no parceiro) e já liquidado na conta."""

    permission_classes = [permissions.IsAuthenticated, InstitutionRole]

    @extend_schema(responses=inline_serializer("Balances", {"a_liquidar": serializers.IntegerField(),
                                                           "liquidado": serializers.IntegerField(),
                                                           "conta_destino": serializers.CharField()}))  # fmt: skip
    def get(self, request, institution_slug):
        inst = resolve_membership(request, institution_slug).institution
        return Response({
            "a_liquidar": -balance(Account.INSTITUTION_PAYABLE, inst),
            "liquidado": inst.settlements.aggregate(s=Sum("net"))["s"] or 0,
            "conta_destino": f"{inst.settlement_bank} {inst.settlement_account_masked}".strip(),
        })  # fmt: skip


def three_ds_hash(reference: str, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"3ds:{reference}:{code}".encode(), hashlib.sha256).hexdigest()


class ThreeDSThrottle(AnonRateThrottle):
    scope = "otp"


class ThreeDSRequest(serializers.Serializer):
    code = serializers.RegexField(r"^\d{6}$")


class ThreeDSVerify(APIView):
    """Confirma o código 3-D Secure. Três tentativas erradas recusam o pagamento, como num emissor real."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ThreeDSThrottle]
    MAX_ATTEMPTS = 3

    @extend_schema(request=ThreeDSRequest, responses=PaymentSerializer)
    def post(self, request, reference):
        s = ThreeDSRequest(data=request.data)
        s.is_valid(raise_exception=True)
        with db.atomic():
            txn = Transaction.objects.select_for_update().filter(reference=reference).first()
            if txn is None:
                return Response(status=404)
            if not txn.three_ds_hash or txn.status != Status.PENDING:
                return Response({"detail": "Este pagamento não está à espera de autenticação."}, status=409)
            if not hmac.compare_digest(txn.three_ds_hash, three_ds_hash(txn.reference, s.validated_data["code"])):
                attempts = txn.three_ds_attempts + 1
                if attempts >= self.MAX_ATTEMPTS:
                    Transaction.objects.filter(pk=txn.pk).update(three_ds_hash="", three_ds_attempts=attempts)
                    transition(txn.pk, Status.FAILED, reason="Autenticação 3-D Secure falhada.")
                    return Response({"detail": "Código errado três vezes. O banco recusou o pagamento."}, status=400)
                Transaction.objects.filter(pk=txn.pk).update(three_ds_attempts=attempts)
                left = self.MAX_ATTEMPTS - attempts
                plural = "s" if left > 1 else ""
                return Response({"detail": f"Código incorrecto. Restam {left} tentativa{plural}."}, status=400)
            Transaction.objects.filter(pk=txn.pk).update(three_ds_hash="")
            txn.refresh_from_db()
            get_provider(txn.method).schedule(txn, txn.provider_ref)  # autenticado: o adquirente autoriza
        txn.refresh_from_db()
        return Response(PaymentSerializer(txn).data)
