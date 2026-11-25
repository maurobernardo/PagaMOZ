"""Camada de provedores de pagamento. Simuladores agora; adaptadores reais quando houver docs oficiais."""

import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings
from django.db import transaction as db

from .models import Method, Transaction

SCENARIOS = {
    "sucesso": "Confirma após ~3 s",
    "falha": "Provedor recusa (saldo insuficiente)",
    "atraso": "Confirma após ~30 s",
    "timeout": "Nunca responde; a transacção expira",
    "duplicado": "Provedor reporta o mesmo pagamento duas vezes (eventos diferentes)",
    "webhook_repetido": "O mesmo webhook chega duas vezes",
}


@dataclass
class Initiation:
    provider_ref: str
    instructions: str  # o que o cidadão tem de fazer (ex. confirmar PIN no telemóvel)
    challenge_code: str = ""  # cartão: código 3-D Secure "enviado pelo banco emissor"


class PaymentProvider(Protocol):
    method: str

    def initiate(self, txn: Transaction) -> Initiation: ...
    def check_status(self, txn: Transaction) -> str | None: ...
    def parse_webhook(self, body: bytes, signature: str) -> dict: ...
    def refund(self, txn: Transaction) -> None: ...


class InvalidSignature(Exception):
    pass


def sign(body: bytes) -> str:
    return hmac.new(settings.WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()


def verify(body: bytes, signature: str) -> None:
    if not signature or not hmac.compare_digest(sign(body), signature):
        raise InvalidSignature


INSTRUCTIONS = {
    Method.MPESA: "Confirme o pagamento com o seu PIN no telemóvel.",
    Method.EMOLA: "Confirme o pagamento com o seu PIN no telemóvel.",
    Method.MKESH: "Confirme o pagamento com o seu PIN no telemóvel.",
    Method.CARD: "Conclua a autenticação do cartão (3-D Secure).",
    Method.BANK: "Pague no banco ou homebanking com a entidade 99999 e a referência indicada.",
    Method.QR: "Leia o código QR com a app do seu banco ou carteira.",
}


class SimulatedProvider:
    """Um simulador por método. Cenário escolhido na criação (só em DEMO_MODE)."""

    def __init__(self, method: str):
        self.method = method

    def initiate(self, txn):
        ref = f"SIM-{self.method[:3].upper()}-{secrets.token_hex(6)}"
        if self.method == Method.CARD:
            # Como num adquirente real: o emissor pede autenticação 3-D Secure antes de autorizar.
            return Initiation(provider_ref=ref, instructions="Introduza o código 3-D Secure enviado pelo seu banco.",
                              challenge_code=f"{secrets.randbelow(10**6):06d}")  # fmt: skip
        self.schedule(txn, ref)
        return Initiation(provider_ref=ref, instructions=INSTRUCTIONS[self.method])

    def schedule(self, txn, ref):
        """Agenda a resposta do provedor (webhook assinado) conforme o cenário."""
        from .tasks import deliver_simulated_webhook  # evita import circular

        scenario = txn.demo_scenario or "sucesso"
        delay = {"sucesso": 3, "atraso": 30}.get(scenario, 2)
        if scenario != "timeout":
            outcome = "falhou" if scenario == "falha" else "pago"
            ev = {"event_id": secrets.token_hex(8), "provider_ref": ref, "reference": txn.reference, "status": outcome}
            events = [(ev, delay)]
            if scenario == "webhook_repetido":
                events.append((ev, delay + 1))
            if scenario == "duplicado":
                events.append(({**ev, "event_id": secrets.token_hex(8)}, delay + 2))
            # Só depois do commit: a transacção já está PENDENTE quando o webhook chega.
            for e, d in events:
                db.on_commit(lambda e=e, d=d: deliver_simulated_webhook.apply_async((self.method, e), countdown=d))

    def check_status(self, txn):
        return None  # simulador só fala por webhook; reconciliação (Fase 6) usa o "ficheiro" do provedor

    def parse_webhook(self, body, signature):
        verify(body, signature)
        data = json.loads(body)
        if not {"event_id", "provider_ref", "reference", "status"} <= data.keys():
            raise ValueError("Webhook incompleto.")
        return data

    def refund(self, txn):
        return None


PROVIDERS: dict[str, PaymentProvider] = {m: SimulatedProvider(m) for m in Method.values}


def get_provider(method: str) -> PaymentProvider:
    return PROVIDERS[method]
