import pytest


@pytest.mark.django_db
def test_suggestions_pair_typo_reference_and_commission_difference():
    from reconciliation.models import Discrepancy
    from reconciliation.suggest import suggest

    K = Discrepancy.Kind
    a = Discrepancy(pk=1, kind=K.MISSING_AT_PROVIDER, reference="PMZ1234567890", platform_amount=50_000)
    b = Discrepancy(pk=2, kind=K.MISSING_AT_PLATFORM, reference="PMZ1234567B90", provider_amount=50_000)
    s = suggest(b, [a, b])
    assert s["pair"] == 1 and s["confidence"] == 0.9 and "1 carácter" in s["text"]

    c = Discrepancy(pk=3, kind=K.AMOUNT, reference="PMZX", platform_amount=100_000, provider_amount=98_500)
    from institutions.models import Institution

    c.institution = Institution.objects.create(name="Inst X", slug="inst-x", commission_bps=150)
    s = suggest(c, [c])
    assert s["action"] == "resolver" and "comissão" in s["text"]
