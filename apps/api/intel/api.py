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
        },
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
        ),
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
            },
        ),
    )
    def post(self, request):
        r = scam_check(str(request.data.get("message", ""))[:2000])
        log("scam_check", request, level=r["level"])
        return Response(r)


class Ussd(APIView):
    """Callback USSD do agregador. Resposta em texto: "CON …" continua a sessão, "END …" termina."""

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []  # o agregador não tem sessão; o número vem no pedido
    parser_classes = [FormParser, MultiPartParser]

    @extend_schema(
        request={
            "application/x-www-form-urlencoded": {
                "type": "object",
                "properties": {
                    "sessionId": {"type": "string"},
                    "phoneNumber": {"type": "string"},
                    "text": {"type": "string"},
                },
            }
        },
        responses={(200, "text/plain"): str},
    )
    def post(self, request):
        from django.http import HttpResponse

        from .ussd import handle

        phone = str(request.data.get("phoneNumber", ""))
        out = handle(phone, str(request.data.get("text", "")))
        log("ussd", None, step=str(request.data.get("text", ""))[:1], end=out.startswith("END"))
        return HttpResponse(out, content_type="text/plain; charset=utf-8")


class SplitCreateSerializer(serializers.Serializer):
    service = serializers.IntegerField()
    fields = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False, default=dict)
    total = serializers.IntegerField(min_value=1)
    names = serializers.ListField(
        child=serializers.CharField(max_length=40, allow_blank=True), min_length=2, max_length=10
    )
    title = serializers.CharField(max_length=80, required=False, allow_blank=True)


def _split_body(sb) -> dict:
    from .split import share_state

    shares = [
        {
            "id": s.id,
            "position": s.position,
            "name": s.name,
            "amount": s.amount,
            "state": share_state(s),
            "reference": s.transaction.reference if s.transaction_id else None,
        }
        for s in sb.shares.select_related("transaction")
    ]
    return {
        "code": sb.code,
        "title": sb.title,
        "total": sb.total,
        "service": sb.service_id,
        "service_name": sb.service.name,
        "institution_name": sb.service.institution.name,
        "fields": sb.fields,
        "shares": shares,
        "paid": sum(s["amount"] for s in shares if s["state"] == "pago"),
    }


class SplitCreate(APIView):
    """Divide uma conta de valor livre em partes iguais (2 a 10). Cada parte paga-se por um link."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AssistantThrottle]

    @extend_schema(
        request=SplitCreateSerializer, responses={201: inline_serializer("Split", {"code": serializers.CharField()})}
    )
    def post(self, request):
        from payments.domain import PaymentError, validate_fields

        from .split import create_split, shares_for

        s = SplitCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        svc = _public_services().select_related("institution").filter(pk=d["service"]).first()
        if svc is None:
            return Response({"detail": "Serviço não encontrado."}, status=404)
        if svc.pricing != "aberto":
            return Response({"detail": "Só é possível dividir serviços em que se escolhe o valor."}, status=400)
        try:
            fields = validate_fields(svc, d["fields"])
        except PaymentError as e:
            return Response({"fields": e.args[0]} if isinstance(e.args[0], dict) else {"detail": e.args[0]}, status=400)
        parts = shares_for(d["total"], len(d["names"]))
        if svc.min_amount and min(parts) < svc.min_amount or svc.max_amount and max(parts) > svc.max_amount:
            return Response(
                {"detail": "Com este número de pessoas, cada parte fica fora dos limites do serviço."}, status=400
            )
        names = [n.strip() or f"Pessoa {i + 1}" for i, n in enumerate(d["names"])]
        sb = create_split(svc, fields, d["total"], names, d.get("title") or svc.name, request.user)
        log("split", request, parts=len(names))
        return Response(_split_body(sb), status=201)


class SplitDetail(APIView):
    """Estado da conta dividida: quem já pagou e quanto falta (o código é a chave de acesso)."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses=inline_serializer("SplitDetail", {"code": serializers.CharField(), "shares": serializers.ListField()})
    )
    def get(self, request, code):
        from .models import SplitBill

        sb = SplitBill.objects.select_related("service__institution").filter(code=code.upper()).first()
        if sb is None:
            return Response({"detail": "Divisão não encontrada."}, status=404)
        return Response(_split_body(sb))
