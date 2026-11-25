import json
import random
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import Category, Service
from institutions.models import Institution, Membership
from ledger.models import Account, Journal, Posting, Unbalanced, balance, post, trial_balance
from payments.domain import TRANSITIONS, InvalidTransition, compute_commission, transition
from payments.models import DeadLetter, Status, Transaction, WebhookEvent
from payments.providers import sign
from payments.tasks import deliver_simulated_webhook, expire_stale_payments
from settlement.services import SETTLEMENT_PROVIDER, run_daily_settlement

pytestmark = pytest.mark.django_db
S = Status


@pytest.fixture
def svc():
    cat = Category.objects.create(name="Água", slug="agua")
    inst = Institution.objects.create(name="Águas Demo", slug="aguas", commission_bps=150,
                                      settlement_bank="Banco X", settlement_account_masked="****1234")  # fmt: skip
    return Service.objects.create(
        institution=inst, category=cat, name="Fatura", slug="fatura", integration_level=2, pricing="aberto",
        min_amount=1000, fields=[{"name": "contrato", "label": "Contrato", "type": "text", "pattern": r"^\d{6}$"}],
    )  # fmt: skip


def pay(svc, key="chave-0001", scenario="sucesso", amount=100_000, client=None, **extra):
    body = {"service": svc.id, "fields": {"contrato": "123456"}, "amount": amount, "method": "mpesa",
            "scenario": scenario, **extra}  # fmt: skip
    return (client or APIClient()).post("/api/payments", body, format="json", HTTP_IDEMPOTENCY_KEY=key)


def run(svc, django_capture_on_commit_callbacks, **kw):
    """Cria o pagamento e executa os webhooks agendados (Celery eager)."""
    with django_capture_on_commit_callbacks(execute=True):
        r = pay(svc, **kw)
    return r, Transaction.objects.filter(reference=r.json().get("reference")).first()


# ---------- Comissões (inteiros, sem float) ----------


def test_commission_half_up_integer():
    assert compute_commission(100_000, 150, 0) == 1_500
    assert compute_commission(33, 150, 0) == 0  # 0,495 -> 0
    assert compute_commission(34, 150, 0) == 1  # 0,51 -> 1
    assert compute_commission(100_000, 0, 500) == 500


def test_institution_pays_commission(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks)
    assert (t.amount, t.commission, t.total, t.institution_net) == (100_000, 1_500, 100_000, 98_500)


def test_citizen_pays_commission(svc, django_capture_on_commit_callbacks):
    Institution.objects.filter(pk=svc.institution_id).update(commission_payer="cidadao")
    _, t = run(svc, django_capture_on_commit_callbacks)
    assert (t.total, t.institution_net) == (101_500, 100_000)


# ---------- Cenários do simulador ----------


def test_success_confirms_and_posts_ledger(svc, django_capture_on_commit_callbacks):
    r, t = run(svc, django_capture_on_commit_callbacks)
    assert r.status_code == 201 and r.json()["status"] == "PENDENTE"
    assert t.status == S.CONFIRMED and t.confirmed_at
    assert balance(Account.PROVIDER_RECEIVABLE) == 100_000
    assert -balance(Account.INSTITUTION_PAYABLE, svc.institution) == 98_500
    assert -balance(Account.PLATFORM_REVENUE) == 1_500
    assert trial_balance() == 0


def test_failure(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks, scenario="falha")
    assert t.status == S.FAILED and t.failure_reason
    assert not Journal.objects.exists()


def test_timeout_expires(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks, scenario="timeout")
    assert t.status == S.PENDING
    Transaction.objects.filter(pk=t.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
    assert expire_stale_payments() == 1
    t.refresh_from_db()
    assert t.status == S.EXPIRED


def test_late_payment_after_expiry_is_recognised(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks, scenario="timeout")
    transition(t.pk, S.EXPIRED)
    ev = {"event_id": "late1", "provider_ref": t.provider_ref, "reference": t.reference, "status": "pago"}
    deliver_simulated_webhook(t.method, ev)
    t.refresh_from_db()
    assert t.status == S.CONFIRMED and trial_balance() == 0


def test_repeated_webhook_applied_once(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks, scenario="webhook_repetido")
    assert t.status == S.CONFIRMED
    assert list(WebhookEvent.objects.values_list("outcome", flat=True)) == ["aplicado"]
    assert Journal.objects.count() == 1


def test_duplicate_provider_payment_posts_once(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks, scenario="duplicado")
    assert sorted(WebhookEvent.objects.values_list("outcome", flat=True)) == ["aplicado", "ja_aplicado"]
    assert Journal.objects.count() == 1
    assert balance(Account.PROVIDER_RECEIVABLE) == t.total


def test_failure_after_confirmation_does_not_touch_money(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks)
    ev = {"event_id": "x2", "provider_ref": t.provider_ref, "reference": t.reference, "status": "falhou"}
    deliver_simulated_webhook(t.method, ev)
    t.refresh_from_db()
    assert t.status == S.CONFIRMED
    assert WebhookEvent.objects.get(event_id="x2").outcome == "ignorado_confirmada"


# ---------- Webhook HTTP: assinatura ----------


def test_webhook_rejects_bad_signature(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks, scenario="timeout")
    body = json.dumps({"event_id": "e1", "provider_ref": t.provider_ref, "reference": t.reference, "status": "pago"})
    c = APIClient()
    r = c.post("/api/webhooks/mpesa", body, content_type="application/json", HTTP_X_SIGNATURE="00" * 32)
    assert r.status_code == 401
    t.refresh_from_db()
    assert t.status == S.PENDING
    r = c.post("/api/webhooks/mpesa", body, content_type="application/json", HTTP_X_SIGNATURE=sign(body.encode()))
    assert r.status_code == 200 and r.json()["outcome"] == "aplicado"


def test_webhook_wrong_provider_ref_ignored(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks, scenario="timeout")
    deliver_simulated_webhook("mpesa", {"event_id": "z", "provider_ref": "FORJADO", "reference": t.reference,
                                        "status": "pago"})  # fmt: skip
    t.refresh_from_db()
    assert t.status == S.PENDING


def test_dead_letter_after_retries(monkeypatch):
    def boom(*a):
        raise RuntimeError("provedor em baixo")

    monkeypatch.setattr("payments.tasks.process_webhook", boom)
    res = deliver_simulated_webhook.apply(args=("mpesa", {"event_id": "d"}), retries=5)
    assert res.get() == "dead-letter"
    assert DeadLetter.objects.get().kind == "webhook:mpesa"


# ---------- Idempotência e validação ----------


def test_idempotency_key_replay_and_conflict(svc):
    r1 = pay(svc, key="abc-12345")
    r2 = pay(svc, key="abc-12345")
    assert r1.status_code == 201 and r2.status_code == 200
    assert r1.json()["reference"] == r2.json()["reference"]
    assert r2.headers["Idempotent-Replay"] == "true"
    assert Transaction.objects.count() == 1
    assert pay(svc, key="abc-12345", amount=999_999).status_code == 409


def test_missing_idempotency_key(svc):
    assert pay(svc, key="").status_code == 400


def test_field_validation_and_limits(svc):
    c = APIClient()
    body = {"service": svc.id, "fields": {"contrato": "12"}, "amount": 5000, "method": "mpesa"}
    r = c.post("/api/payments", body, format="json", HTTP_IDEMPOTENCY_KEY="val-00001")
    assert r.status_code == 400 and "contrato" in r.json()["fields"]
    assert pay(svc, key="val-00002", amount=500).status_code == 400  # abaixo do mínimo


def test_public_detail_hides_internal_fields(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks)
    d = APIClient().get(f"/api/payments/{t.reference}").json()
    assert d["status"] == "CONFIRMADA"
    assert not {"payload", "payer_phone", "provider_ref", "idempotency_key"} & d.keys()


# ---------- Máquina de estados ----------


def test_invalid_transitions_rejected(svc, django_capture_on_commit_callbacks):
    _, t = run(svc, django_capture_on_commit_callbacks, scenario="falha")
    for target in (S.CONFIRMED, S.SETTLED, S.PENDING):
        with pytest.raises(InvalidTransition):
            transition(t.pk, target)


def test_terminal_states_have_no_exit():
    assert TRANSITIONS[S.FAILED] == set() and TRANSITIONS[S.REVERSED] == set()


# ---------- Ledger ----------


def test_ledger_rejects_unbalanced_and_float():
    with pytest.raises(Unbalanced):
        post("x", "k1", [(Account.PROVIDER_RECEIVABLE, None, 100, 0), (Account.PLATFORM_REVENUE, None, 0, 99)])
    with pytest.raises(Unbalanced):
        post("x", "k2", [(Account.PROVIDER_RECEIVABLE, None, 1.5, 0), (Account.PLATFORM_REVENUE, None, 0, 1.5)])


def test_ledger_is_append_only(svc, django_capture_on_commit_callbacks):
    run(svc, django_capture_on_commit_callbacks)
    p = Posting.objects.first()
    for action in (p.save, p.delete, Posting.objects.all().delete, Journal.objects.all().delete,
                   lambda: Posting.objects.update(debit=1)):  # fmt: skip
        with pytest.raises(PermissionError):
            action()


def test_ledger_invariants_random_lifecycles(svc, django_capture_on_commit_callbacks):
    """Propriedade: qualquer sequência de eventos válidos mantém o ledger balanceado e coerente."""
    rng = random.Random(2026)
    Institution.objects.filter(pk=svc.institution_id).update(commission_fixed=250)
    scenarios = ["sucesso", "falha", "timeout", "duplicado", "webhook_repetido"]
    for i in range(60):
        _, t = run(svc, django_capture_on_commit_callbacks, key=f"prop-{i:05d}", scenario=rng.choice(scenarios),
                   amount=rng.randint(1_000, 5_000_000))  # fmt: skip
        if t.status == S.CONFIRMED and rng.random() < 0.3:
            transition(t.pk, S.REVERSED, reason="estorno")
        if t.status == S.PENDING and rng.random() < 0.5:
            transition(t.pk, S.EXPIRED)
        assert trial_balance() == 0
    SETTLEMENT_PROVIDER.settle(svc.institution, timezone.localdate())

    txns = Transaction.objects.all()
    settled = txns.filter(status=S.SETTLED)
    assert trial_balance() == 0
    # Tudo o que foi liquidado saiu do provedor; nada confirmado fica pendurado.
    assert balance(Account.PROVIDER_RECEIVABLE) == 0
    assert balance(Account.INSTITUTION_PAYABLE, svc.institution) == 0
    assert sum(b.net for b in svc.institution.settlements.all()) == sum(t.institution_net for t in settled)
    assert balance(Account.PLATFORM_CASH) == sum(t.total - t.institution_net for t in settled)
    # Cada transacção confirmada tem exactamente um lançamento de confirmação.
    for t in txns.filter(status__in=[S.SETTLED, S.REVERSED]):
        assert Journal.objects.filter(key=f"confirm:{t.reference}").count() == 1
    assert not Journal.objects.filter(transaction__status__in=[S.FAILED, S.EXPIRED]).exists()


# ---------- Liquidação ----------


def test_settlement_batch_and_portal(svc, django_capture_on_commit_callbacks):
    for i in range(3):
        run(svc, django_capture_on_commit_callbacks, key=f"set-{i:05d}")
    run(svc, django_capture_on_commit_callbacks, key="set-fail1", scenario="falha")

    assert run_daily_settlement() == 1
    assert run_daily_settlement() == 0  # idempotente por dia
    batch = svc.institution.settlements.get()
    assert (batch.count, batch.gross, batch.commission, batch.net) == (3, 300_000, 4_500, 295_500)
    assert batch.destination == "Banco X ****1234"
    assert Transaction.objects.filter(status=S.SETTLED, settlement=batch).count() == 3

    u = User.objects.create_user("+258840000111")
    Membership.objects.create(user=u, institution=svc.institution, role="financeiro")
    c = APIClient()
    c.force_authenticate(u)
    assert c.get("/api/portal/aguas/balances").json() == {"a_liquidar": 0, "liquidado": 295_500,
                                                          "conta_destino": "Banco X ****1234"}  # fmt: skip
    assert c.get("/api/portal/aguas/settlements").json()["results"][0]["net"] == 295_500

    other = Institution.objects.create(name="Outra", slug="outra")
    u2 = User.objects.create_user("+258840000112")
    Membership.objects.create(user=u2, institution=other, role="admin")
    c.force_authenticate(u2)
    assert c.get("/api/portal/aguas/balances").status_code == 404


# ---------- Cartão com 3-D Secure ----------

CARD = {"token": "tok_" + "a1B2c3D4e5F6g7H8", "brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2099,
        "holder": "ANA MACHAVA"}  # fmt: skip


def card_pay(svc, key, card=CARD, cb=None):
    body = {"service": svc.id, "fields": {"contrato": "123456"}, "amount": 100_000, "method": "cartao", "card": card}
    return APIClient().post("/api/payments", body, format="json", HTTP_IDEMPOTENCY_KEY=key)


def test_card_never_accepts_full_number_or_cvv(svc):
    r = card_pay(svc, "card-pan-01", card={**CARD, "number": "4242424242424242", "cvv": "123"})
    assert r.status_code == 400 and "nunca" in str(r.json())
    assert card_pay(svc, "card-exp-01", card={**CARD, "exp_year": 2020}).status_code == 400
    no_card = {"service": svc.id, "fields": {"contrato": "123456"}, "amount": 1000, "method": "cartao"}
    assert (
        APIClient().post("/api/payments", no_card, format="json", HTTP_IDEMPOTENCY_KEY="card-none-1").status_code == 400
    )


def test_card_requires_3ds_then_confirms(svc, django_capture_on_commit_callbacks):
    r = card_pay(svc, "card-3ds-01")
    assert r.status_code == 201
    body = r.json()
    assert body["next_action"] == "3ds" and body["status"] == "PENDENTE" and body["card_last4"] == "4242"
    ref, code = body["reference"], body["demo_3ds_code"]
    c = APIClient()
    wrong = "000000" if code != "000000" else "111111"
    assert "Restam 2" in c.post(f"/api/payments/{ref}/3ds", {"code": wrong}, format="json").json()["detail"]
    with django_capture_on_commit_callbacks(execute=True):
        ok = c.post(f"/api/payments/{ref}/3ds", {"code": code}, format="json")
    assert ok.status_code == 200
    t = Transaction.objects.get(reference=ref)
    assert t.status == "CONFIRMADA" and t.card_brand == "visa" and not t.three_ds_hash
    assert c.post(f"/api/payments/{ref}/3ds", {"code": code}, format="json").status_code == 409


def test_card_three_wrong_codes_fail_payment(svc):
    body = card_pay(svc, "card-3ds-02").json()
    wrong = "000000" if body["demo_3ds_code"] != "000000" else "111111"
    for _ in range(3):
        r = APIClient().post(f"/api/payments/{body['reference']}/3ds", {"code": wrong}, format="json")
    assert "recusou" in r.json()["detail"]
    assert Transaction.objects.get(reference=body["reference"]).status == "FALHADA"
