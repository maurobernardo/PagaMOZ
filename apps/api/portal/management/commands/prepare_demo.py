"""Prepara tudo para a apresentação: catálogo, utilizadores, 30 dias de actividade e reconciliação com divergências."""

from datetime import timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Dados completos para a demonstração (idempotente)."

    def handle(self, *args, **opts):
        call_command("seed_demo", stdout=self.stdout)
        call_command("seed_demo_activity", stdout=self.stdout)
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        call_command("demo_reconciliation", data=yesterday, injectar=True, stdout=self.stdout)
        self.stdout.write(self.style.SUCCESS("Demo pronta. Guião em docs/guiao-demo.md."))
