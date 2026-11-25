from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from catalog.api import _public_services
from payments.domain import PaymentError, price, validate_fields

from .base import ConnectorUnavailable, LookupError_, get_connector
from .models import Quote


class LookupThrottle(AnonRateThrottle):
    scope = "lookup"  # contador próprio (ver OtpThrottle); consulta revela dados: limitar enumeração


class QuoteRequest(serializers.Serializer):
    fields = serializers.DictField(child=serializers.CharField(allow_blank=True))
    amount = serializers.IntegerField(
        required=False, min_value=1, help_text="Centavos, nos serviços de valor livre (ex.: Credelec)."
    )


class QuoteItem(serializers.Serializer):
    titulo = serializers.CharField()
    referencia = serializers.CharField()
    detalhe = serializers.CharField()
    valor = serializers.IntegerField()


class QuoteResponse(serializers.ModelSerializer):
    commission = serializers.IntegerField()
    total = serializers.IntegerField()
    commission_payer = serializers.CharField()
    details = serializers.ListField(child=serializers.ListField(child=serializers.CharField()))
    items = QuoteItem(many=True)

    class Meta:
        model = Quote
        fields = ["id", "amount", "description", "holder", "details", "items", "expires_at", "commission", "total",
                  "commission_payer"]  # fmt: skip


class ServiceQuote(APIView):
    """Nível 1/2 com valor por consulta: pergunta à instituição quanto se deve."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [LookupThrottle]

    @extend_schema(request=QuoteRequest, responses=QuoteResponse)
    def post(self, request, pk):
        service = get_object_or_404(_public_services(), pk=pk)
        has_profile = bool((service.connector_config or {}).get("profile"))
        if service.pricing != "consulta" and not (service.pricing == "aberto" and has_profile):
            return Response({"detail": "Este serviço não tem consulta à instituição."}, status=400)
        s = QuoteRequest(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            from payments.domain import resolve_amount

            payload = validate_fields(service, s.validated_data["fields"])
            amount = resolve_amount(service, s.validated_data.get("amount")) if service.pricing == "aberto" else None
            data = get_connector(service).lookup(service, payload, amount)
        except PaymentError as e:
            msg = e.args[0]
            return Response({"detail": msg} if isinstance(msg, str) else {"fields": msg}, status=400)
        except LookupError_ as e:
            return Response({"detail": str(e)}, status=404)
        except ConnectorUnavailable as e:
            return Response({"detail": str(e)}, status=503, headers={"Retry-After": "30"})
        q = Quote.objects.create(
            service=service, payload=payload, amount=data.amount, description=data.description[:200],
            holder=data.holder, external_ref=data.external_ref, details=data.details, items=data.items,
            expires_at=timezone.now() + timedelta(minutes=data.valid_minutes),
        )  # fmt: skip
        p = price(service, q.amount)
        q.commission, q.total, q.commission_payer = p["commission"], p["total"], p["commission_payer"]
        return Response(QuoteResponse(q).data, status=201)


class PriceRequest(serializers.Serializer):
    amount = serializers.IntegerField(required=False, min_value=1)


class PriceResponse(serializers.Serializer):
    amount = serializers.IntegerField()
    commission = serializers.IntegerField()
    total = serializers.IntegerField()
    commission_payer = serializers.CharField()
    institution_net = serializers.IntegerField()


class ServicePrice(APIView):
    """Decomposição do valor (comissão, total) antes de pagar — serviços de valor fixo ou aberto."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(request=PriceRequest, responses=PriceResponse)
    def post(self, request, pk):
        from payments.domain import resolve_amount

        service = get_object_or_404(_public_services(), pk=pk)
        s = PriceRequest(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            return Response(price(service, resolve_amount(service, s.validated_data.get("amount"))))
        except PaymentError as e:
            return Response({"detail": e.args[0]}, status=400)
