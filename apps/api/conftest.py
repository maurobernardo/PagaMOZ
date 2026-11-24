import pytest


@pytest.fixture(autouse=True)
def _fast_password_hasher(settings):
    # PBKDF2 real custa ~1 s por utilizador; nos testes não interessa.
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
