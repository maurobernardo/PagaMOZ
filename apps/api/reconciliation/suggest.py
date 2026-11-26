"""Sugestões para discrepâncias de reconciliação: propõe a causa provável e o que fazer; a pessoa aprova.

Regras (explicáveis):
- referência com 1 carácter diferente e o mesmo valor -> é o mesmo pagamento (erro de digitação no provedor);
- par "falta no provedor" + "falta na plataforma" com o mesmo valor -> o mesmo pagamento com referências trocadas;
- diferença de valor igual à comissão da instituição -> o provedor descontou a comissão;
- pagamento confirmado perto da meia-noite em falta no provedor -> deve vir no extracto do dia seguinte;
- estornado no provedor e confirmado na plataforma -> reverter o pagamento.
"""

from django.utils import timezone

from payments.models import Transaction

from .models import Discrepancy

K = Discrepancy.Kind


def _one_off(a: str, b: str) -> bool:
    if not a or not b or abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b, strict=True)) == 1
    s, longer = (a, b) if len(a) < len(b) else (b, a)
    return any(longer[:i] + longer[i + 1 :] == s for i in range(len(longer)))


def suggest(item: Discrepancy, siblings: list[Discrepancy]) -> dict | None:
    others = [o for o in siblings if o.pk != item.pk and not o.resolved]
    if item.kind in (K.MISSING_AT_PLATFORM, K.MISSING_AT_PROVIDER):
        want = K.MISSING_AT_PROVIDER if item.kind == K.MISSING_AT_PLATFORM else K.MISSING_AT_PLATFORM
        amt = item.provider_amount if item.kind == K.MISSING_AT_PLATFORM else item.platform_amount
        for o in others:
            o_amt = o.platform_amount if item.kind == K.MISSING_AT_PLATFORM else o.provider_amount
            if o.kind == want and o_amt == amt:
                close = _one_off(item.reference, o.reference)
                why = "a referência difere em 1 carácter" if close else "o valor é igual no mesmo dia"
                return {
                    "text": f"É provavelmente o mesmo pagamento que {o.reference or o.provider_ref}: {why}. "
                    "Marque os dois como resolvidos.",
                    "confidence": 0.9 if close else 0.6,
                    "pair": o.pk,
                    "action": "resolver_par",
                }
    if item.kind == K.AMOUNT and item.platform_amount and item.provider_amount and item.institution_id:
        diff = item.platform_amount - item.provider_amount
        bps = item.institution.commission_bps
        if diff > 0 and abs(diff - round(item.platform_amount * bps / 10_000)) <= 1:
            return {
                "text": f"A diferença ({diff / 100:.2f} MT) é igual à comissão de {bps / 100:.1f}%: "
                "o provedor enviou o valor líquido. Não há dinheiro em falta.",
                "confidence": 0.85,
                "action": "resolver",
            }
    if item.kind == K.MISSING_AT_PROVIDER and item.reference:
        t = Transaction.objects.filter(reference=item.reference).only("confirmed_at").first()
        if t and t.confirmed_at and timezone.localtime(t.confirmed_at).hour >= 23:
            return {
                "text": "Foi confirmado depois das 23h: deve aparecer no extracto do dia seguinte. "
                "Aguarde a próxima reconciliação antes de agir.",
                "confidence": 0.7,
                "action": "aguardar",
            }
    if item.kind == K.STATUS:
        return {
            "text": "O provedor estornou este pagamento. Se o cidadão não recebeu o serviço, reverta-o; "
            "caso contrário, contacte o provedor.",
            "confidence": 0.5,
            "action": "rever",
        }
    return None


if __name__ == "__main__":
    assert _one_off("PMZ1234567890", "PMZ1234567B90") and _one_off("ABC", "AB") and not _one_off("ABC", "XYZ")
    print("ok")
