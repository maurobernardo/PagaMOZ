import hashlib
import json

from django.conf import settings
from django.db import IntegrityError
from django.db import transaction as db
from django.db.models import Sum
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
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


class PaymentCreateSerializer(serializers.Serializer):
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.filter(is_active=True))
    fields = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False, default=dict)
    amount = serializers.IntegerField(required=False, min_value=1, help_text="Centavos (serviços de valor aberto).")
    method = serializers.ChoiceField(Method.choices)
    payer_phone = serializers.RegexField(r"^\+258[28]\d{8}$", required=False, allow_blank=True)
    scenario = serializers.ChoiceField(list(SCENARIOS), required=False, help_text="Só em ambiente de demonstração.")
    quote = serializers.CharField(required=False, help_text="Obrigatório em serviços de valor por consulta.")
    request = serializers.CharField(required=False, help_text="Código do pedido (serviços de nível 3).")


class PaymentSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name")
    institution_name = serializers.CharField(source="institution.name")
    instructions = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "reference", "status", "service", "service_name", "institution_name", "description",
            "amount", "commission", "commission_payer", "total", "institution_net", "currency",
            "method", "instructions", "failure_reason", "created_at", "expires_at", "confirmed_at", "settled_at",
        ]  # fmt: skip
        read_only_fields = fields

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
                transition(txn.pk, Status.PENDING, provider_ref=init.provider_ref)
        except PaymentError as e:
            return Response({"detail": e.args[0]} if isinstance(e.args[0], str) else {"fields": e.args[0]}, 400)
        except IntegrityError:  # corrida com o mesmo Idempotency-Key
            return self._replay(Transaction.objects.get(idempotency_key=key), req_hash)
        txn.refresh_from_db()
        return Response(PaymentSerializer(txn).data, status=201)

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
