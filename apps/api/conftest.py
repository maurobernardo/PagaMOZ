import pytest


@pytest.fixture(autouse=True)
def _fast_password_hasher(settings):
    # PBKDF2 real custa ~1 s por utilizador; nos testes não interessa.
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    from django.core.cache import cache

    cache.clear()
