"""Cria (ou promove) um super admin da plataforma pelo email e imprime o link para ele definir a senha.

    python manage.py create_staff --email pessoa@exemplo.com --name "Nome Apelido"

A senha nunca passa por aqui: quem vai usar a conta define-a no link (válido 3 dias).
Depois, ao entrar no backoffice, configura o MFA na app autenticadora.
"""

from django.core.management.base import BaseCommand

from accounts.invite import invite_link, send_invite
from accounts.models import User


class Command(BaseCommand):
    help = "Cria um super admin (equipa PagaMOZ) e mostra o link para definir a senha."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--name", default="")

    def handle(self, email, name, **_):
        email = email.strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            first, _, last = name.strip().partition(" ")
            user = User.objects.create_user(None, email=email, first_name=first, last_name=last)
        user.is_staff = user.is_superuser = True
        user.is_active = True
        user.save(update_fields=["is_staff", "is_superuser", "is_active"])
        sent = send_invite(user)
        self.stdout.write(self.style.SUCCESS(f"Super admin: {email}"))
        self.stdout.write(f"Link para definir a senha (3 dias){' (também enviado por email)' if sent else ''}:")
        self.stdout.write(invite_link(user))
