import hashlib

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import IntegrityError
from django.db import transaction as db
from django.utils import timezone

from payments.models import Method, Transaction

from .models import Receipt, canonical, sign
from .pdf import render

PAYER = {"cidadao": "cidadão", "instituicao": "instituição"}
# Desligado só por geração em massa de dados demo; o PDF é emitido no primeiro download (ReceiptPdf).
ISSUE_ON_CONFIRM = True


def verify_url(code: str) -> str:
    return f"{settings.PUBLIC_WEB_URL.rstrip('/')}/verificar/{code}"


def _content(txn: Transaction, code: str, issued) -> dict:
    local = timezone.localtime(txn.confirmed_at or issued)
    # Minimização: nada de telefone, NUIT, nome ou dados do formulário — só o necessário para provar o pagamento.
    return {
        "codigo": f"{code[:5]}-{code[5:]}",
        "referencia": txn.reference,
        "instituicao": txn.institution.name,
        "servico": txn.service.name,
        "detalhe": txn.description if txn.description != txn.service.name else "",
        "metodo": Method(txn.method).label,
        "data_hora": local.strftime("%d/%m/%Y %H:%M") + " (Maputo)",
        "valor": txn.amount,
        "comissao": txn.commission,
        "comissao_paga_por": PAYER.get(txn.commission_payer, txn.commission_payer),
        "total": txn.total,
        "estado": "PAGO",
        # O que a instituição entregou (ex.: código Credelec) — faz parte do que se prova.
        "entrega": [txn.delivery.get("titulo", ""), txn.delivery.get("codigo", "")]
        if txn.delivery.get("codigo")
        else [],
        "moeda": txn.currency,
        "demo": settings.DEMO_MODE,
    }


def issue(txn_id: int) -> Receipt:
    """Emite (uma vez) o comprovativo de uma transacção confirmada. Idempotente."""
    if (r := Receipt.objects.filter(transaction_id=txn_id).first()) is not None:
        return r
    txn = Transaction.objects.select_related("institution", "service").get(pk=txn_id)
    issued = timezone.now()
    r = Receipt(transaction=txn, issued_at=issued, is_demo=settings.DEMO_MODE)
    r.content = _content(txn, r.code, issued)
    r.content_hash = hashlib.sha256(canonical(r.content)).hexdigest()
    r.signature = sign(r.content)
    pdf = render({**r.content, "_hash": r.content_hash}, verify_url(r.code), r.is_demo)
    r.pdf_sha256 = hashlib.sha256(pdf).hexdigest()
    r.pdf.save(f"{r.code}.pdf", ContentFile(pdf), save=False)
    try:
        with db.atomic():
            r.save()
    except IntegrityError:  # corrida: outro worker emitiu primeiro
        r.pdf.delete(save=False)
        return Receipt.objects.get(transaction_id=txn_id)
    return r


@shared_task(bind=True, max_retries=5, retry_backoff=True)
def issue_receipt(self, txn_id: int) -> str:
    try:
        return issue(txn_id).code
    except Exception as exc:
        raise self.retry(exc=exc) from exc
