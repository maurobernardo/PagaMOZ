"""Padrão de conectores: cada serviço fala com a instituição através de um ServiceConnector.

Só o `SimulatedConnector` existe. Adaptadores reais entram em `connectors/adapters/<nome>.py`
depois de haver documentação oficial da API da instituição: nunca endpoints inventados.
"""

import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from django.utils import timezone


class LookupError_(Exception):
    """Consulta recusada pela instituição (ex. referência inexistente). Mensagem apresentável."""


class ConnectorUnavailable(Exception):
    """Falha técnica/temporária; pode ser repetida."""


@dataclass
class QuoteData:
    amount: int | None  # centavos
    description: str
    holder: str = ""
    external_ref: str = ""
    valid_minutes: int = 30
    details: list = field(default_factory=list)  # [[rótulo, valor], …] mostrados ao cidadão
    items: list = field(default_factory=list)  # faturas/multas/prestações: {titulo, referencia, detalhe, valor}


@dataclass
class Confirmation:
    institution_ref: str
    received_at: datetime = field(default_factory=timezone.now)
    delivery: dict = field(default_factory=dict)  # o que a instituição entrega (ex.: código Credelec)


@dataclass
class RequestStatus:
    status: str
    note: str = ""


class ServiceConnector(Protocol):
    def lookup(self, service, payload: dict, amount: int | None = None) -> QuoteData: ...
    def confirm_payment(self, transaction) -> Confirmation: ...
    def reverse(self, transaction) -> None: ...
    def request_status(self, service_request) -> RequestStatus: ...


FIRST = ["Ana", "João", "Maria", "Carlos", "Fátima", "Alberto", "Graça", "Hélder", "Celeste", "Tomás"]
LAST = ["Machava", "Cossa", "Sitoe", "Mondlane", "Nhantumbo", "Langa", "Muianga", "Chissano", "Bila"]


def _mask(name: str) -> str:
    return " ".join(p[0] + "*" * (len(p) - 1) for p in name.split())


class SimulatedConnector:
    """Respostas determinísticas a partir dos dados introduzidos (a mesma referência dá o mesmo valor).

    `service.connector_config` (todos opcionais):
      min / max          intervalo do valor em centavos (omissão 50 000 – 1 500 000)
      not_found_suffix   referências que terminam assim dão "não encontrado" (omissão "0000")
      unavailable_suffix ... dão indisponibilidade técnica (omissão "9999")
      valid_minutes      validade da cotação (omissão 30)
    """

    def lookup(self, service, payload, amount=None):
        cfg = service.connector_config or {}
        key = "|".join(str(payload[k]) for k in sorted(payload))
        if key.endswith(cfg.get("not_found_suffix", "0000")):
            raise LookupError_("Referência não encontrada na instituição.")
        if key.endswith(cfg.get("unavailable_suffix", "9999")):
            raise ConnectorUnavailable("Instituição temporariamente indisponível.")
        if cfg.get("profile"):
            from .simulated import lookup as profile_lookup

            return profile_lookup(service, payload, amount)
        h = int(hashlib.sha256(f"{service.pk}|{key}".encode()).hexdigest(), 16)
        lo, hi = cfg.get("min", 50_000), cfg.get("max", 1_500_000)
        amount = lo + h % (hi - lo + 1)
        amount -= amount % 100  # valores redondos ao metical
        holder = f"{FIRST[h % len(FIRST)]} {LAST[(h // 7) % len(LAST)]}"
        return QuoteData(
            amount=max(amount, lo), description=f"{service.name}: {key.split('|')[-1]}",
            holder=_mask(holder), external_ref=f"SIMREF{h % 10**8:08d}",
            valid_minutes=cfg.get("valid_minutes", 30),
        )  # fmt: skip

    def confirm_payment(self, transaction):
        profile = (transaction.service.connector_config or {}).get("profile")
        if profile:
            from .simulated import deliver

            return deliver(profile, transaction)
        return Confirmation(institution_ref=f"SIM-ACK-{transaction.reference}")

    def reverse(self, transaction):
        return None

    def request_status(self, service_request):
        # No simulador o estado vive na plataforma (a instituição actualiza-o pelo portal).
        return RequestStatus(status=service_request.status)


CONNECTORS: dict[str, ServiceConnector] = {"simulado": SimulatedConnector()}


def get_connector(service) -> ServiceConnector:
    return CONNECTORS[service.connector]
