"""Gera 30 dias de pagamentos fictícios por instituição, liquidados dia a dia, para o portal ter histórico."""

import random
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.db import transaction as db
from django.utils import timezone

from accounts.models import User
from accounts.totp import new_secret
from catalog.models import Service
from institutions.models import Institution
from payments.domain import price, transition
from payments.models import Method, Status, Transaction
from settlement.services import SETTLEMENT_PROVIDER

MAPUTO = ZoneInfo("Africa/Maputo")
WEIGHTS = {Method.MPESA: 45, Method.EMOLA: 20, Method.MKESH: 8, Method.CARD: 15, Method.BANK: 7, Method.QR: 5}


class Command(BaseCommand):
    help = "Actividade de demonstração (30 dias). Idempotente: não repete se já houver histórico."

    def add_arguments(self, parser):
        parser.add_argument("--dias", type=int, default=30)
        parser.add_argument("--seed", type=int, default=2026)

    def handle(self, *args, dias, seed, **opts):
        # MFA já activo nos admins demo (o código aparece no ecrã de login em DEMO_MODE).
        for u in User.objects.filter(memberships__isnull=False, mfa_enabled=False).distinct():
            u.mfa_secret, u.mfa_enabled = new_secret(), True
            u.save(update_fields=["mfa_secret", "mfa_enabled"])

        if Transaction.objects.filter(idempotency_key__startswith="demo-").exists():
            self.stdout.write("Actividade demo já existe.")
            return
        rng = random.Random(seed)
        today = timezone.localdate()
        n = 0
        for inst in Institution.objects.filter(is_demo=True):
            services = list(Service.objects.filter(institution=inst, is_active=True))
            for back in range(dias, -1, -1):
                day = today - timedelta(days=back)
                for _ in range(rng.randint(0, 6) + (3 if day.weekday() < 5 else 0)):
                    s = rng.choice(services)
                    amount = s.amount or rng.randrange(20_000, 900_000, 500)
                    at = datetime.combine(day, time(rng.randint(7, 19), rng.randint(0, 59)), tzinfo=MAPUTO)
                    if at > timezone.now():
                        continue
                    method = rng.choices(list(WEIGHTS), weights=list(WEIGHTS.values()))[0]
                    fail = rng.random() < 0.06
                    with db.atomic():
                        t = Transaction.objects.create(
                            service=s, institution=inst, method=method, description=s.name,
                            idempotency_key=f"demo-{inst.pk}-{n}", payload={}, **price(s, amount),
                        )  # fmt: skip
                        transition(t.pk, Status.PENDING, provider_ref=f"SIM-{method[:3].upper()}-D{n:07d}")
                        if fail:
                            transition(t.pk, Status.FAILED, reason="Saldo insuficiente.")
                        else:
                            transition(t.pk, Status.CONFIRMED, confirmed_at=at)
                        Transaction.objects.filter(pk=t.pk).update(created_at=at - timedelta(seconds=40))
                    n += 1
                if back > 0:  # liquidação diária até ontem; hoje fica "a liquidar"
                    SETTLEMENT_PROVIDER.settle(inst, day)
        self.stdout.write(self.style.SUCCESS(f"{n} pagamentos demo gerados."))
