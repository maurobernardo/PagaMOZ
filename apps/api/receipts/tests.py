import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from catalog.models import Category, Service
from institutions.models import Institution
from payments.domain import transition
from payments.models import Transaction
from receipts.models import Receipt
from receipts.pdf import render
from receipts.services import issue

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def paid(django_capture_on_commit_callbacks):
    cat = Category.objects.create(name="Água", slug="agua")
    inst = Institution.objects.create(name="Águas do Índico", slug="aguas", commission_bps=150)
    s = Service.objects.create(institution=inst, category=cat, name="Inspecção", slug="i", integration_level=2,
                               pricing="fixo", amount=80_000)  # fmt: skip
    with django_capture_on_commit_callbacks(execute=True):
        r = APIClient().post("/api/payments", {"service": s.id, "method": "mpesa", "scenario": "sucesso",
                                               "payer_phone": "+258841234567"}, format="json",
                             HTTP_IDEMPOTENCY_KEY="rcpt-0001")  # fmt: skip
    return Transaction.objects.get(reference=r.json()["reference"])


def pdf_bytes(ref):
    r = APIClient().get(f"/api/payments/{ref}/receipt.pdf")
    assert r.status_code == 200 and r["Content-Type"] == "application/pdf"
    return b"".join(r.streaming_content)


def upload(data: bytes):
    return APIClient().post("/api/receipts/verify", {"file": SimpleUploadedFile("c.pdf", data)}, format="multipart")


def test_issued_on_confirmation_with_minimal_content(paid):
    r = paid.receipt
    assert r.integrity_ok() and r.pdf_sha256 and r.is_demo
    assert r.content["total"] == 80_000 and r.content["referencia"] == paid.reference
    flat = str(r.content)
    assert "841234567" not in flat  # telefone do pagador não vai para o comprovativo


def test_pdf_is_valid_deterministic_and_watermarked(paid):
    data = pdf_bytes(paid.reference)
    assert data.startswith(b"%PDF-") and data == pdf_bytes(paid.reference)
    content = {**paid.receipt.content, "_hash": paid.receipt.content_hash}
    plain = render(content, "http://x/verificar/C", demo=True, compress=False)
    assert b"DEMONSTRA" in plain and paid.reference.encode() in plain
    assert b"DEMONSTRA" not in render(content, "http://x/verificar/C", demo=False, compress=False)


def test_untouched_pdf_verifies(paid):
    v = upload(pdf_bytes(paid.reference))
    assert v.status_code == 200 and v.json()["resultado"] == "valido"
    assert v.json()["referencia"] == paid.reference


def test_tampered_pdf_fails(paid):
    data = pdf_bytes(paid.reference)
    tampered = data.replace(b"/Title", b"/Titlx", 1)  # um único byte alterado
    assert tampered != data
    assert upload(tampered).status_code == 404
    assert upload(data + b"\n").status_code == 404
    assert upload(b"%PDF-1.4 falso").json()["resultado"] == "nao_reconhecido"


def test_verify_by_code_public_and_without_personal_data(paid):
    r = paid.receipt
    for code in (r.code, r.display_code, r.display_code.lower()):
        v = APIClient().get(f"/api/receipts/{code}")
        assert v.status_code == 200 and v.json()["resultado"] == "valido"
    assert "phone" not in str(v.json()) and "payload" not in v.json()
    assert APIClient().get("/api/receipts/AAAAAAAAAA").status_code == 404


def test_tampered_database_record_detected(paid):
    Receipt.objects.filter(pk=paid.receipt.pk).update(content={**paid.receipt.content, "total": 1})
    assert APIClient().get(f"/api/receipts/{paid.receipt.code}").json()["resultado"] == "adulterado"


def test_reversed_payment_receipt_is_annulled(paid):
    transition(paid.pk, "REVERTIDA", reason="estorno")
    assert APIClient().get(f"/api/receipts/{paid.receipt.code}").json()["resultado"] == "anulado"


def test_issue_is_idempotent_and_immutable(paid):
    assert issue(paid.pk).pk == paid.receipt.pk
    assert Receipt.objects.count() == 1
    r = paid.receipt
    r.content = {**r.content, "total": 1}
    with pytest.raises(PermissionError):
        r.save()


def test_no_receipt_for_unpaid(django_capture_on_commit_callbacks):
    cat = Category.objects.create(name="X", slug="x")
    inst = Institution.objects.create(name="X", slug="x")
    s = Service.objects.create(institution=inst, category=cat, name="S", slug="s", integration_level=2,
                               pricing="fixo", amount=1000)  # fmt: skip
    with django_capture_on_commit_callbacks(execute=True):
        r = APIClient().post("/api/payments", {"service": s.id, "method": "mpesa", "scenario": "falha"},
                             format="json", HTTP_IDEMPOTENCY_KEY="rcpt-fail")  # fmt: skip
    ref = r.json()["reference"]
    assert APIClient().get(f"/api/payments/{ref}/receipt.pdf").status_code == 404
    assert not Receipt.objects.exists()
