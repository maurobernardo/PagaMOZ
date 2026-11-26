"""Dividir uma conta: só em serviços de valor livre (cada parte é um pagamento aceite pela instituição)."""

import secrets

from django.db import transaction as db

from payments.models import Status

from .models import SplitBill, SplitShare

ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
PAID = (Status.CONFIRMED, Status.SETTLED)
LIVE = (Status.CREATED, Status.PENDING, *PAID)


def shares_for(total: int, n: int) -> list[int]:
    """Partes iguais em centavos; o resto vai para as primeiras (a soma é sempre o total)."""
    base, rest = divmod(total, n)
    return [base + (1 if i < rest else 0) for i in range(n)]


@db.atomic
def create_split(service, fields: dict, total: int, names: list[str], title: str, user=None) -> SplitBill:
    code = "DIV" + "".join(secrets.choice(ALPHABET) for _ in range(7))
    sb = SplitBill.objects.create(code=code, service=service, fields=fields, total=total, title=title[:80],
                                  created_by=user if user and user.is_authenticated else None)  # fmt: skip
    for i, amt in enumerate(shares_for(total, len(names))):
        SplitShare.objects.create(split=sb, position=i + 1, name=names[i][:40], amount=amt)
    return sb


def share_state(share: SplitShare) -> str:
    t = share.transaction
    if t is None or t.status not in LIVE:
        return "por_pagar"
    return "pago" if t.status in PAID else "a_pagar"


def claim(share_id: int, service_id: int, amount: int, txn) -> None:
    """Liga um pagamento a uma parte. Erro se a parte já está paga ou em pagamento, ou não corresponde."""
    from payments.domain import PaymentError

    share = SplitShare.objects.select_for_update().select_related("split").filter(pk=share_id).first()
    if share is None or share.split.service_id != service_id or share.amount != amount:
        raise PaymentError("Esta parte não corresponde a este pagamento.")
    if share_state(share) != "por_pagar":
        raise PaymentError("Esta parte já foi paga ou está a ser paga.")
    share.transaction = txn
    share.save(update_fields=["transaction"])


if __name__ == "__main__":
    assert shares_for(100_001, 3) == [33_334, 33_334, 33_333] and sum(shares_for(100_001, 3)) == 100_001
    print("ok")
