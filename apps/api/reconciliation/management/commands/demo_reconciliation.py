from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from reconciliation.services import (
    SimulatedStatementSource,
    import_statement,
    inject_demo_divergences,
    reconcile,
)


class Command(BaseCommand):
    help = "Importa o extracto simulado de um dia, injecta divergências (opcional) e reconcilia."

    def add_arguments(self, parser):
        parser.add_argument("--data", help="AAAA-MM-DD (omissão: hoje)")
        parser.add_argument("--injectar", action="store_true", help="provoca uma divergência de cada tipo")

    def handle(self, *args, data=None, injectar=False, **opts):
        d = date.fromisoformat(data) if data else timezone.localdate()
        n = import_statement(d, SimulatedStatementSource().fetch(d))
        if injectar:
            for msg in inject_demo_divergences(d):
                self.stdout.write(f"  injectado: {msg}")
        run = reconcile(d)
        self.stdout.write(self.style.SUCCESS(
            f"{d}: {n} linhas do provedor, {run.matched} conferidas, {run.discrepancies} divergências."))  # fmt: skip
