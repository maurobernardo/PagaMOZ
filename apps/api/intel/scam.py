"""Escudo contra burlas: avalia uma mensagem (SMS, WhatsApp) por sinais conhecidos de fraude.

Regras explicáveis, cada uma com o motivo em linguagem simples. Não é infalível: diz "risco", nunca "seguro".
"""

import re

from catalog.search import norm

_BLOCK = "bloquead|suspens|desactivad|desativad|cancelad"
_ACCOUNT = "conta|numero|cartao|m pesa|mpesa|e mola|emola|mkesh"

# (peso, motivo, padrão sobre o texto normalizado)
SIGNALS: list[tuple[int, str, str]] = [
    (
        4,
        "Pede o seu PIN, palavra-passe ou código. Nenhuma instituição pede isto por mensagem.",
        r"\b(pin|senha|palavra passe|password|codigo (de )?(confirmacao|verificacao|seguranca)|otp)\b",
    ),
    (
        3,
        "Diz que enviou dinheiro «por engano» e pede devolução. É uma burla muito comum.",
        r"(por engano|enviei sem querer|devolva|devolver o valor|reembolse)",
    ),
    (
        3,
        "Promete prémio, sorteio ou dinheiro fácil.",
        r"\b(premio|ganhou|ganhaste|sorteio|sortead[oa]|bonus|parabens voce foi|vencedor)\b",
    ),
    (
        3,
        "Ameaça bloquear ou suspender a sua conta para o pressionar.",
        rf"(({_BLOCK}).{{0,30}}({_ACCOUNT})|({_ACCOUNT}).{{0,30}}({_BLOCK}))",
    ),
    (
        2,
        "Cria pressa («urgente», «hoje», «em 24 horas»).",
        r"\b(urgente|imediatamente|agora mesmo|ultimo aviso|24 ?h(oras)?|hoje ainda)\b",
    ),
    (
        2,
        "Tem um link. Abra só links que espera receber e confirme o endereço.",
        r"(https?\s?:|www |bit ly|\.com\b|\.co\b|\.xyz|\.top|wa me)",
    ),
    (
        2,
        "Pede para enviar dinheiro ou pagar uma «taxa» para receber algo.",
        r"(envie|enviar|transfira|transferir|pague|pagar).{0,40}(taxa|custo|valor|mt|meticais)",
    ),
    (
        2,
        "Pede para ligar ou responder para outro número.",
        r"(ligue|liga|contacte|responda).{0,25}\b8[2-7] ?\d{3} ?\d{4}\b",
    ),
    (1, "Pede dados pessoais (BI, NUIT, número do cartão).", r"\b(bi|nuit|numero do cartao|cvv|data de nascimento)\b"),
]


def check(message: str) -> dict:
    t = norm(message)
    reasons, score = [], 0
    for weight, why, rx in SIGNALS:
        if re.search(rx, t):
            reasons.append(why)
            score += weight
    level = "alto" if score >= 5 else "medio" if score >= 3 else "baixo"
    summary = {
        "alto": "Risco alto de burla. Não responda, não envie dinheiro nem códigos.",
        "medio": "Cuidado: esta mensagem tem sinais de burla. Confirme directamente com a instituição.",
        "baixo": "Não encontrei sinais claros de burla, mas nunca partilhe o PIN nem códigos.",
    }[level]
    return {
        "level": level,
        "score": score,
        "reasons": reasons,
        "summary": summary,
        "tip": "Para confirmar um pagamento recebido, veja o saldo na sua carteira; não confie só na mensagem.",
    }
