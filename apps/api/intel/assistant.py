"""Assistente por texto, sem modelo pago: intenção por regras + pesquisa inteligente do catálogo.

Devolve uma resposta curta e acções (abrir serviço preenchido, abrir pagamento, abrir ecrã).
Nunca paga: a acção leva ao ecrã de confirmação de sempre.
"""

import re

from catalog.search import norm, rank
from payments.models import Transaction

from .insights import bills
from .scam import check as scam_check

AMOUNT = re.compile(r"(\d{1,3}(?:[ .]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:mt|mzn|meticais|meticais?)?\b", re.I)
REF = re.compile(r"\b(PMZ[0-9A-Z]{10}|PED[0-9A-Z]{10})\b", re.I)
VERIFY = re.compile(r"\b([2-9A-HJKMNP-Z]{5}-?[2-9A-HJKMNP-Z]{5})\b")

INTENTS = [
    (
        "scam",
        ["burla", "golpe", "fraude", "falso", "falsa", "enganar", "suspeito", "suspeita", "e verdade", "isto e real"],
    ),
    ("bills", ["vence", "vencer", "vencem", "contas", "devo", "a pagar esta", "esta semana", "este mes", "prazo"]),
    ("status", ["estado", "pronto", "ja pagou", "confirmado", "onde esta", "acompanhar", "seguir"]),
    ("energy", ["energia", "luz acaba", "dias de luz", "quanto tempo", "credelec dura"]),
    ("help", ["ajuda", "o que fazes", "o que podes", "como funciona", "ola", "bom dia", "boa tarde", "boa noite"]),
]


def _amount(text: str) -> int | None:
    for m in AMOUNT.finditer(text):
        whole = m.group(1).replace(" ", "").replace(".", "")
        if len(whole) > 7 or re.fullmatch(r"8[2-7]\d{7}", whole):  # números de telefone/contador não são valores
            continue
        cents = int(whole) * 100 + int((m.group(2) or "0").ljust(2, "0"))
        if 1_000 <= cents <= 5_000_000:  # entre 10 MT e 50 000 MT, como nos serviços de valor livre
            return cents
    return None


def _intent(t: str) -> str:
    for name, words in INTENTS:
        if any(w in t for w in words):
            return name
    return "pay"


def reply(message: str, services, user=None) -> dict:
    text = message.strip()[:500]
    t = norm(text)
    if not t:
        return {"reply": "Escreva o que quer pagar, por exemplo: «paga 500 de Credelec».", "actions": []}

    if m := REF.search(text):
        ref = m.group(1).upper()
        if ref.startswith("PED"):
            return {
                "reply": f"Abro o pedido {ref}.",
                "actions": [{"type": "open", "path": f"/pedido/{ref}", "label": "Ver pedido"}],
            }
        p = Transaction.objects.filter(reference=ref).values("status").first()
        if not p:
            return {"reply": f"Não encontro o pagamento {ref}. Confirme o código.", "actions": []}
        return {
            "reply": f"O pagamento {ref} está: {p['status'].lower()}.",
            "actions": [{"type": "payment", "reference": ref, "label": "Ver pagamento"}],
        }
    if VERIFY.search(text) and "comprovativo" in t:
        code = VERIFY.search(text).group(1).replace("-", "")
        return {
            "reply": "Vou verificar esse comprovativo.",
            "actions": [{"type": "open", "path": f"/verificar/{code}", "label": "Verificar"}],
        }

    intent = _intent(t)
    authed = bool(user and user.is_authenticated)

    if intent == "scam":
        r = scam_check(text)
        return {"reply": r["summary"], "scam": r, "actions": []}

    if intent in ("bills", "energy"):
        if not authed:
            return {
                "reply": "Entre na sua conta para eu ver as suas contas.",
                "actions": [{"type": "open", "path": "/entrar", "label": "Entrar"}],
            }
        b = bills(user)
        if intent == "energy" or ("credelec" in t or "luz" in t or "energia" in t):
            c = next((x for x in b["credelec"] if x.get("days_left") is not None), None)
            if c:
                return {
                    "reply": f"O contador {c['key']} tem cerca de {max(0, c['days_left'])} dias de energia. "
                    f"{c['explain']}",
                    "actions": [
                        {
                            "type": "service",
                            "service": c["service"],
                            "fields": c["payload"],
                            "amount": c["last_amount"],
                            "label": "Recarregar",
                        }
                    ],
                }
        due = [r for r in b["recurring"] if r["days_left"] <= 7]
        if not due:
            return {
                "reply": "Não vejo contas a vencer nos próximos 7 dias.",
                "actions": [{"type": "open", "path": "/contas", "label": "Contas da casa"}],
            }
        lines = "; ".join(
            f"{r['service_name']} ({r['typical_amount'] / 100:.0f} MT, daqui a {r['days_left']} dias)" for r in due[:3]
        )
        return {
            "reply": f"A vencer esta semana: {lines}.",
            "actions": [
                {
                    "type": "service",
                    "service": r["service"],
                    "fields": r["payload"],
                    "amount": r["typical_amount"],
                    "label": f"Pagar {r['service_name']}",
                }
                for r in due[:3]
            ],
        }

    if intent == "help":
        return {
            "reply": "Posso preparar pagamentos («paga 200 de recarga Vodacom»), dizer o que vence, "
            "quanto dura a sua energia, o estado de um pagamento (PMZ…) e avisar se uma mensagem parece burla.",
            "actions": [],
            "suggestions": ["O que vence esta semana?", "Paga 500 de Credelec", "Isto é burla?"],
        }

    # Pagar: conta guardada com nome ("casa da mãe") ou serviço pela pesquisa.
    amount = _amount(text)
    mt = f", {amount / 100:.0f} MT" if amount else ""
    if authed:
        from accounts.models import SavedObligation

        for ob in SavedObligation.objects.filter(user=user).select_related("service"):
            if norm(ob.label) and norm(ob.label) in t:
                return {
                    "reply": f"Preparei {ob.service.name} para «{ob.label}»{mt}. Confirme no ecrã seguinte.",
                    "actions": [
                        {
                            "type": "service",
                            "service": ob.service_id,
                            "fields": ob.fields,
                            "amount": amount,
                            "label": "Rever e pagar",
                        }
                    ],
                }
    stop = {
        "paga",
        "pagar",
        "pague",
        "quero",
        "de",
        "do",
        "da",
        "para",
        "a",
        "o",
        "um",
        "uma",
        "meu",
        "minha",
        "mt",
        "meticais",
        "por",
        "favor",
    }
    query = " ".join(w for w in t.split() if w not in stop and not w.isdigit())
    found = rank(services, query) if query else []
    if not found:
        return {
            "reply": "Não percebi o serviço. Diga, por exemplo: «paga a água», «recarga Movitel 100» "
            "ou «multa do carro».",
            "actions": [],
            "suggestions": ["Paga a luz", "Recarga Vodacom 100", "Multa de trânsito"],
        }
    s = found[0]
    others = [{"type": "service", "service": o.id, "fields": {}, "amount": amount, "label": o.name} for o in found[1:3]]
    return {
        "reply": f"Encontrei {s.name} ({s.institution.name}){mt}. Abro para completar e confirmar.",
        "actions": [
            {"type": "service", "service": s.id, "fields": {}, "amount": amount, "label": "Continuar"},
            *others,
        ],
    }
