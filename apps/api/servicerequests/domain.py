import hashlib

from django.db import transaction as db

from audit.models import record

from .models import INSTITUTION_TRANSITIONS, Attachment, RequestEvent, RequestStatus, ServiceRequest

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_FILES = 5
# Tipo declarado não chega: confirmar pelos primeiros bytes.
MAGIC = {
    "application/pdf": b"%PDF-",
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
}


class RequestError(ValueError):
    pass


def _check_file(f) -> tuple[str, str]:
    if f.size > MAX_FILE_BYTES:
        raise RequestError(f"{f.name}: excede 5 MB.")
    head = f.read(8)
    f.seek(0)
    ctype = next((t for t, sig in MAGIC.items() if head.startswith(sig)), None)
    if ctype is None:
        raise RequestError(f"{f.name}: só PDF, JPG ou PNG.")
    h = hashlib.sha256()
    for chunk in f.chunks():
        h.update(chunk)
    f.seek(0)
    return ctype, h.hexdigest()


def create_request(service, form: dict, files: dict, *, user=None, phone="") -> ServiceRequest:
    from payments.domain import validate_fields  # mesmas regras de campos que o pagamento

    if service.integration_level != 3:
        raise RequestError("Este serviço não é um pedido assistido.")
    clean = validate_fields(service, form)
    file_fields = [f for f in service.fields if f["type"] == "file"]
    if len(files) > MAX_FILES:
        raise RequestError("Demasiados anexos.")
    errors = {
        f["name"]: "Anexo obrigatório." for f in file_fields if f.get("required", True) and f["name"] not in files
    }
    unknown = set(files) - {f["name"] for f in file_fields}
    errors.update({k: "Anexo não esperado." for k in unknown})
    if errors:
        raise RequestError(errors)
    checked = {name: (f, *_check_file(f)) for name, f in files.items()}

    with db.atomic():
        req = ServiceRequest.objects.create(service=service, institution=service.institution, user=user,
                                            applicant_phone=phone, form=clean)  # fmt: skip
        for name, (f, ctype, digest) in checked.items():
            Attachment.objects.create(request=req, field=name, file=f, original_name=f.name[:200],
                                      content_type=ctype, size=f.size, sha256=digest)  # fmt: skip
        RequestEvent.objects.create(request=req, status=req.status, note="Pedido criado.")
    return req


def mark_paid(request_id: int) -> None:
    """Chamado dentro da transição CONFIRMADA do pagamento."""
    req = ServiceRequest.objects.select_for_update().get(pk=request_id)
    if req.status != RequestStatus.AWAITING_PAYMENT:
        return
    req.status = RequestStatus.SUBMITTED
    req.save(update_fields=["status", "updated_at"])
    RequestEvent.objects.create(request=req, status=req.status, note="Pagamento confirmado; enviado à instituição.")


def set_status(req: ServiceRequest, new: str, *, actor, note: str = "", request=None) -> ServiceRequest:
    with db.atomic():
        req = ServiceRequest.objects.select_for_update().get(pk=req.pk)
        if new not in INSTITUTION_TRANSITIONS.get(req.status, set()):
            raise RequestError(f"Transição inválida: {req.status} → {new}.")
        if new in (RequestStatus.REJECTED, RequestStatus.NEEDS_INFO) and not note.strip():
            raise RequestError("Indique o motivo ao cidadão.")
        old, req.status = req.status, new
        req.save(update_fields=["status", "updated_at"])
        RequestEvent.objects.create(request=req, status=new, note=note[:500], actor=actor)
        record("request.status", request=request, actor=actor, institution=req.institution, target=req,
               de=old, para=new)  # fmt: skip
    return req
