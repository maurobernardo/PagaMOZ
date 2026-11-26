"""Menu USSD (*…#) para quem não tem smartphone nem internet.

Formato dos agregadores (ex.: Africa's Talking): POST com sessionId, serviceCode, phoneNumber e text
(as respostas da sessão juntas por "*"). A resposta é texto: "CON …" continua, "END …" termina.
Os pagamentos passam pelos mesmos endpoints da app (mesma validação, consulta e provedor).

ponytail: reutiliza as views por um pedido interno; extrair um serviço de domínio partilhado se o USSD crescer.
"""

import re
import uuid

from rest_framework.test import APIRequestFactory

from accounts.models import User
from catalog.models import Service
from payments.models import Transaction

from .insights import bills

PREFIX_METHOD = {"84": "mpesa", "85": "mpesa", "86": "emola", "87": "emola", "82": "mkesh", "83": "mkesh"}
METHOD_NAME = {"mpesa": "M-Pesa", "emola": "e-Mola", "mkesh": "mKesh"}
OPERATORS = [("vodacom", "Vodacom"), ("movitel", "Movitel"), ("tmcel", "Tmcel")]
STATUS_PT = {
    "CRIADA": "Criado",
    "PENDENTE": "A aguardar confirmação",
    "CONFIRMADA": "Pago",
    "LIQUIDADA": "Pago",
    "FALHADA": "Falhou",
    "EXPIRADA": "Expirou",
    "REVERTIDA": "Devolvido",
    "EM_DISPUTA": "Em análise",
}

MENU = "CON PagaMOZ\n1. Recarga Credelec\n2. Recarga de saldo\n3. Estado de pagamento\n4. Contas a vencer\n0. Sair"


def _post(view, path: str, data: dict, **headers):
    req = APIRequestFactory().post(path, data, format="json", **headers)
    return view(req, **({"pk": data.pop("_pk")} if "_pk" in data else {}))


def _local(phone: str) -> str:
    d = re.sub(r"\D", "", phone)
    return d[-9:]


def _mt(v: str) -> int | None:
    v = v.replace(",", ".").strip()
    if not re.fullmatch(r"\d{1,6}(\.\d{1,2})?", v):
        return None
    c = round(float(v) * 100)
    return c if 1_000 <= c <= 5_000_000 else None


def _pay(service: Service, fields: dict, amount: int, phone: str, quote: str | None = None) -> str:
    from payments.api import PaymentCreate

    method = PREFIX_METHOD.get(_local(phone)[:2])
    if not method:
        return "END Este número não tem carteira móvel (M-Pesa, e-Mola ou mKesh)."
    body = {"service": service.id, "method": method, "fields": fields, "payer_phone": "+258" + _local(phone)}
    body.update({"quote": quote} if quote else {"amount": amount})
    r = _post(PaymentCreate.as_view(), "/api/payments", body, HTTP_IDEMPOTENCY_KEY=f"ussd-{uuid.uuid4().hex}")
    if r.status_code not in (200, 201):
        detail = r.data.get("detail") if isinstance(r.data, dict) else None
        return f"END Não foi possível: {detail or 'tente de novo mais tarde.'}"
    return f"END Pedido enviado ao {METHOD_NAME[method]}. Confirme com o seu PIN.\nRef: {r.data['reference']}"


def handle(phone: str, text: str) -> str:
    steps = [s for s in (text or "").split("*")]
    if not text:
        return MENU
    first = steps[0]
    if first == "0":
        return "END Obrigado por usar o PagaMOZ."

    if first == "1":  # Credelec
        cred = Service.objects.filter(slug="credelec", is_active=True).first()
        if not cred:
            return "END Serviço indisponível."
        if len(steps) == 1:
            return "CON N.º do contador Credelec:"
        meter = re.sub(r"\D", "", steps[1])
        if not re.fullmatch(r"\d{11,13}", meter):
            return "END Contador inválido (11 a 13 algarismos)."
        if len(steps) == 2:
            return "CON Valor em MT (mín. 10):"
        amount = _mt(steps[2])
        if amount is None:
            return "END Valor inválido."
        from connectors.api import ServiceQuote

        q = _post(
            ServiceQuote.as_view(),
            f"/api/catalog/services/{cred.id}/quote",
            {"fields": {"contador": meter}, "amount": amount, "_pk": cred.id},
        )
        if q.status_code not in (200, 201):
            return "END Não foi possível consultar o contador."
        if len(steps) == 3:
            holder = q.data.get("holder") or ""
            return f"CON Contador {meter}\n{holder}\nPagar {amount / 100:.0f} MT?\n1. Sim\n2. Não"
        return (
            _pay(cred, {"contador": meter}, amount, phone, quote=q.data["id"]) if steps[3] == "1" else "END Cancelado."
        )

    if first == "2":  # Recarga de saldo
        if len(steps) == 1:
            return "CON Operadora:\n" + "\n".join(f"{i}. {n}" for i, (_, n) in enumerate(OPERATORS, 1))
        try:
            slug = OPERATORS[int(steps[1]) - 1][0]
        except (ValueError, IndexError):
            return "END Opção inválida."
        svc = Service.objects.filter(institution__slug=slug, slug="recarga", is_active=True).first()
        if not svc:
            return "END Serviço indisponível."
        if len(steps) == 2:
            return "CON Número a recarregar (0 = este número):"
        number = _local(phone) if steps[2].strip() == "0" else re.sub(r"\D", "", steps[2])[-9:]
        pattern = next((f.get("pattern") for f in svc.fields if f["name"] == "numero"), None)
        if pattern and not re.fullmatch(pattern, number):
            return "END Número não é desta operadora."
        if len(steps) == 3:
            return "CON Valor em MT (mín. 10):"
        amount = _mt(steps[3])
        if amount is None:
            return "END Valor inválido."
        if len(steps) == 4:
            return f"CON Recarregar {number} com {amount / 100:.0f} MT?\n1. Sim\n2. Não"
        return _pay(svc, {"numero": number}, amount, phone) if steps[4] == "1" else "END Cancelado."

    if first == "3":  # Estado
        if len(steps) == 1:
            return "CON Código do pagamento (PMZ…):"
        ref = steps[1].strip().upper()
        ref = ref if ref.startswith("PMZ") else "PMZ" + ref
        t = Transaction.objects.filter(reference=ref).only("status", "amount").first()
        return (
            f"END {ref}: {STATUS_PT.get(t.status, t.status)} ({t.amount / 100:.0f} MT)"
            if t
            else "END Código não encontrado."
        )

    if first == "4":  # Contas a vencer
        user = User.objects.filter(phone="+258" + _local(phone)).first()
        if not user:
            return "END Ainda não tem conta PagaMOZ com este número."
        b = bills(user)
        lines = [
            f"{r['service_name'][:22]}: {r['typical_amount'] / 100:.0f} MT, {max(0, r['days_left'])}d"
            for r in b["recurring"][:3]
        ]
        lines += [
            f"Credelec {c['key'][-4:]}: ~{c['days_left']} dias"
            for c in b["credelec"][:1]
            if c.get("days_left") is not None
        ]
        return "END " + ("\n".join(lines) if lines else "Sem contas previstas.")

    return "END Opção inválida."
