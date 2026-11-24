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
    rate = "30/min"  # consulta revela dados da instituição: limitar enumeração


class QuoteRequest(serializers.Serializer):
    fields = serializers.DictField(child=serializers.CharField(allow_blank=True))


class QuoteResponse(serializers.ModelSerializer):
    commission = serializers.IntegerField()
    total = serializers.IntegerField()
    commission_payer = serializers.CharField()

    class Meta:
        model = Quote
        fields = ["id", "amount", "description", "holder", "expires_at", "commission", "total", "commission_payer"]


class ServiceQuote(APIView):
    """Nível 1/2 com valor por consulta: pergunta à instituição quanto se deve."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [LookupThrottle]

    @extend_schema(request=QuoteRequest, responses=QuoteResponse)
    def post(self, request, pk):
        service = get_object_or_404(_public_services(), pk=pk)
        if service.pricing != "consulta":
            return Response({"detail": "Este serviço não tem valor por consulta."}, status=400)
        s = QuoteRequest(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            payload = validate_fields(service, s.validated_data["fields"])
            data = get_connector(service).lookup(service, payload)
        except PaymentError as e:
            return Response({"fields": e.args[0]}, status=400)
        except LookupError_ as e:
            return Response({"detail": str(e)}, status=404)
        except ConnectorUnavailable as e:
            return Response({"detail": str(e)}, status=503, headers={"Retry-After": "30"})
        q = Quote.objects.create(
            service=service, payload=payload, amount=data.amount, description=data.description[:200],
            holder=data.holder, external_ref=data.external_ref,
            expires_at=timezone.now() + timedelta(minutes=data.valid_minutes),
        )  # fmt: skip
        p = price(service, q.amount)
        q.commission, q.total, q.commission_payer = p["commission"], p["total"], p["commission_payer"]
        return Response(QuoteResponse(q).data, status=201)
