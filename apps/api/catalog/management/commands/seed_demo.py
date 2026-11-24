import os

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from catalog.demo_data import CATEGORIES, INSTITUTIONS
from catalog.models import Category, Service
from institutions.models import Institution, Membership

DEMO_PASSWORD_ENV = "DEMO_PASSWORD"


class Command(BaseCommand):
    help = "Semeia dados de demonstração (idempotente)."

    @transaction.atomic
    def handle(self, *args, **opts):
        cats = {}
        for order, (slug, name, icon, desc) in enumerate(CATEGORIES, 1):
            cats[slug], _ = Category.objects.update_or_create(
                slug=slug, defaults={"name": name, "icon": icon, "description": desc, "order": order}
            )

        password = os.environ.get(DEMO_PASSWORD_ENV)  # sem variável -> utilizadores sem password
        n_services = 0
        for i, (cat, slug, name, bank, services) in enumerate(INSTITUTIONS, 1):
            inst, _ = Institution.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "settlement_bank": bank,
                    "settlement_account_masked": f"****{1000 + i}",
                    "commission_bps": 150,  # 1,5% por omissão na demo
                    "commission_payer": Institution.Payer.INSTITUTION,
                    "is_demo": True,
                },
            )
            for s_slug, s_name, level, pricing, amount, fields in services:
                Service.objects.update_or_create(
                    institution=inst,
                    slug=s_slug,
                    defaults={
                        "category": cats[cat],
                        "name": s_name,
                        "integration_level": level,
                        "pricing": pricing,
                        "amount": amount,
                        "min_amount": 2_000 if pricing == "aberto" else None,
                        "fields": fields,
                    },
                )
                n_services += 1
            # Um admin por instituição: +2588400000NN (números fictícios de demo).
            admin = self._user(f"+25884000{i:04d}", f"Admin {name[:20]}", password)
            Membership.objects.get_or_create(user=admin, institution=inst, defaults={"role": Membership.Role.ADMIN})

        self._user("+258840009999", "Cidadão Demo", password)
        User.objects.filter(pk=self._user("+258840000000", "Equipa PagaMOZ", password).pk).update(is_staff=True)
        self.stdout.write(
            self.style.SUCCESS(f"{len(cats)} categorias, {len(INSTITUTIONS)} instituições, {n_services} serviços.")
        )
        if not password:
            self.stdout.write(f"Aviso: defina {DEMO_PASSWORD_ENV} para os utilizadores demo poderem entrar.")

    def _user(self, phone, name, password):
        user, created = User.objects.get_or_create(phone=phone, defaults={"first_name": name})
        if password and (created or not user.has_usable_password()):
            user.set_password(password)
            user.save(update_fields=["password"])
        return user
