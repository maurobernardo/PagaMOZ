import hashlib

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from payments.models import Status, Transaction

from .models import Receipt
from .services import issue

MAX_PDF = 2 * 1024 * 1024


class VerifyThrottle(AnonRateThrottle):
    scope = "verify"


STATE = {
    Status.CONFIRMED: ("valido", "Pagamento confirmado."),
    Status.SETTLED: ("valido", "Pagamento confirmado e entregue à instituição."),
    Status.REVERSED: ("anulado", "Este pagamento foi devolvido; o comprovativo já não é válido."),
    Status.DISPUTED: ("em_analise", "Pagamento em análise pela instituição."),
}


class VerificationSerializer(serializers.Serializer):
    resultado = serializers.ChoiceField(["valido", "anulado", "em_analise", "adulterado", "utilizado"])
    mensagem = serializers.CharField()
    codigo = serializers.CharField()
    referencia = serializers.CharField()
    instituicao = serializers.CharField()
    servico = serializers.CharField()
    total = serializers.IntegerField()
    data_hora = serializers.CharField()
    emitido_em = serializers.DateTimeField()
    hash_conteudo = serializers.CharField()
    demonstracao = serializers.BooleanField()
    deposito = serializers.DictField(required=False)
    depositante = serializers.DictField(required=False)
    utilizado_em = serializers.DateTimeField(required=False, allow_null=True)


def verification(r: Receipt) -> dict:
    """Só o que está impresso no próprio comprovativo: sem dados pessoais."""
    if not r.integrity_ok():
        result, msg = "adulterado", "O registo deste comprovativo não confere. Contacte a instituição."
    else:
        result, msg = STATE.get(r.transaction.status, ("em_analise", "Estado em verificação."))
    c = r.content
    return {
        "resultado": result, "mensagem": msg, "codigo": c["codigo"], "referencia": c["referencia"],
        "instituicao": c["instituicao"], "servico": c["servico"], "total": c["total"], "data_hora": c["data_hora"],
        "emitido_em": r.issued_at, "hash_conteudo": r.content_hash, "demonstracao": r.is_demo,
        **_deposit_public(c, r.transaction),
    }  # fmt: skip


def _mask_bi(bi: str) -> str:
    return f"{bi[:4]}•••{bi[-2:]}" if len(bi) > 6 else "•••"


def _deposit_public(c: dict, txn) -> dict:
    if c.get("tipo") != "deposito":
        return {}
    dep = c["depositante"]
    out = {"deposito": c["deposito"], "depositante": {"nome": dep["nome"], "bi": _mask_bi(dep["bi"])},
           "utilizado_em": txn.used_at}  # fmt: skip
    if txn.used_at:
        from django.utils import timezone

        when = timezone.localtime(txn.used_at)
        out["mensagem"] = f"Já utilizado na instituição em {when:%d/%m/%Y %H:%M}. Não aceitar outra vez."
        out["resultado"] = "utilizado"
    return out


def _normalize(code: str) -> str:
    return code.upper().replace("-", "").replace(" ", "")


class VerifyByCode(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [VerifyThrottle]

    @extend_schema(responses=VerificationSerializer)
    def get(self, request, code):
        r = get_object_or_404(Receipt.objects.select_related("transaction"), code=_normalize(code))
        return Response(verification(r))


NOT_ISSUED = inline_serializer("NotIssued", {"resultado": serializers.CharField(), "mensagem": serializers.CharField()})


class VerifyByFile(APIView):
    """Carregar o PDF: válido só se for byte a byte o ficheiro emitido."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [VerifyThrottle]
    parser_classes = [MultiPartParser]

    @extend_schema(
        request={"multipart/form-data": inline_serializer("VerifyFile", {"file": serializers.FileField()})},
        responses={200: VerificationSerializer, 404: NOT_ISSUED},
    )  # fmt: skip
    def post(self, request):
        f = request.FILES.get("file")
        if f is None or f.size > MAX_PDF:
            return Response({"detail": "Envie o PDF do comprovativo (até 2 MB)."}, status=400)
        digest = hashlib.sha256(b"".join(f.chunks())).hexdigest()
        r = Receipt.objects.select_related("transaction").filter(pdf_sha256=digest).first()
        if r is None:
            return Response({"resultado": "nao_reconhecido",
                             "mensagem": "Este ficheiro não corresponde a nenhum comprovativo emitido. "
                                         "Pode ter sido alterado."}, status=404)  # fmt: skip
        return Response(verification(r))


class ReceiptPdf(APIView):
    """PDF pela referência do pagamento (a referência é a capacidade de acesso, como no estado)."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={(200, "application/pdf"): bytes})
    def get(self, request, reference):
        txn = get_object_or_404(Transaction, reference=reference)
        if txn.status not in (Status.CONFIRMED, Status.SETTLED, Status.DISPUTED, Status.REVERSED):
            raise Http404
        r = issue(txn.pk)  # emite se a tarefa ainda não correu
        resp = FileResponse(r.pdf.open("rb"), content_type="application/pdf",
                            filename=f"comprovativo-{txn.reference}.pdf")  # fmt: skip
        resp["Cache-Control"] = "private, max-age=3600"
        return resp
