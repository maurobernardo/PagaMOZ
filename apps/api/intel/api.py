from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from catalog.api import _public_services

from . import assistant, insights, scan
from .models import log
from .scam import check as scam_check


class MethodHealth(APIView):
    """Saúde de cada método de pagamento na última hora e o recomendado agora."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses=inline_serializer(
            "MethodHealth",
            {
                "method": serializers.CharField(),
                "ok": serializers.IntegerField(),
                "failed": serializers.IntegerField(),
                "rate": serializers.FloatField(allow_null=True),
                "state": serializers.CharField(),
                "recommended": serializers.BooleanField(),
            },
            many=True,
        )
    )
    def get(self, request):
        return Response(insights.method_health())


class Bills(APIView):
    """Contas da casa: o que se repete (com próxima data e valor) e a previsão Credelec."""

    @extend_schema(
        responses=inline_serializer(
            "Bills", {"recurring": serializers.ListField(), "credelec": serializers.ListField()}
        )
    )
    def get(self, request):
        return Response(insights.bills(request.user))


class ScanThrottle(UserRateThrottle):
    rate = "30/hour"


class Scan(APIView):
    """Lê uma fatura (foto em `image`, ou texto já lido em `text`) e propõe o pagamento.

    A pessoa revê tudo antes de pagar.
    """

    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScanThrottle]

    @extend_schema(
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {"image": {"type": "string", "format": "binary"}, "text": {"type": "string"}},
            }
        },  # fmt: skip
        responses=inline_serializer(
            "ScanResult",
            {
                "service": serializers.IntegerField(allow_null=True),
                "service_name": serializers.CharField(required=False),
                "institution_name": serializers.CharField(required=False),
                "fields": serializers.DictField(),
                "amount": serializers.IntegerField(allow_null=True),
                "due_date": serializers.CharField(allow_null=True),
                "confidence": serializers.FloatField(),
            },
        ),  # fmt: skip
    )
    def post(self, request):
        text = str(request.data.get("text", ""))[:20000]
        if not text:
            f = request.FILES.get("image")
            if f is None or f.size > 8 * 1024 * 1024:
                return Response({"detail": "Envie uma foto da fatura (até 8 MB)."}, status=400)
            try:
                text = scan.ocr(f)
            except scan.OcrUnavailable as e:
                return Response({"detail": str(e)}, status=503)
            except OSError:
                return Response({"detail": "Esta imagem não pode ser lida."}, status=400)
        result = scan.interpret(text, _public_services().select_related("institution"))
        log("scan", request, service=result.get("service"), confidence=result.get("confidence"))
        return Response(result)


class AssistantThrottle(UserRateThrottle):
    rate = "120/hour"


class Assistant(APIView):
    """Assistente por texto: percebe o pedido e devolve uma resposta curta com acções (nunca paga sozinho)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AssistantThrottle]

    @extend_schema(
        request=inline_serializer("AssistantRequest", {"message": serializers.CharField(max_length=500)}),
        responses=inline_serializer(
            "AssistantReply",
            {
                "reply": serializers.CharField(),
                "actions": serializers.ListField(),
                "suggestions": serializers.ListField(required=False),
            },
        ),
    )
    def post(self, request):
        msg = str(request.data.get("message", ""))[:500]
        out = assistant.reply(msg, _public_services().select_related("institution", "category"), request.user)
        log("assistant", request, intent=(out.get("actions") or [{}])[0].get("type", "texto"))
        return Response(out)


class ScamCheck(APIView):
    """Avalia uma mensagem (SMS/WhatsApp) por sinais de burla, com os motivos."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AssistantThrottle]

    @extend_schema(
        request=inline_serializer("ScamRequest", {"message": serializers.CharField(max_length=2000)}),
        responses=inline_serializer(
            "ScamResult",
            {
                "level": serializers.CharField(),
                "score": serializers.IntegerField(),
                "reasons": serializers.ListField(),
                "summary": serializers.CharField(),
                "tip": serializers.CharField(),
            },  # fmt: skip
        ),
    )
    def post(self, request):
        r = scam_check(str(request.data.get("message", ""))[:2000])
        log("scam_check", request, level=r["level"])
        return Response(r)
