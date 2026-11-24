"""Cifra de campos sensíveis em repouso (Fernet: AES-128-CBC + HMAC-SHA256), com rotação de chaves."""

from functools import cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.db import models

PREFIX = "enc:"


@cache
def _fernet() -> MultiFernet:
    return MultiFernet([Fernet(k.encode()) for k in settings.FIELD_ENCRYPTION_KEYS])


def encrypt(value: str) -> str:
    return PREFIX + _fernet().encrypt(value.encode()).decode() if value else ""


def decrypt(value: str) -> str:
    if not value or not value.startswith(PREFIX):
        return value  # legado em claro: é cifrado na próxima gravação
    try:
        return _fernet().decrypt(value[len(PREFIX) :].encode()).decode()
    except InvalidToken as e:
        raise ValueError("Não foi possível decifrar: chave errada ou dado adulterado.") from e


class EncryptedCharField(models.TextField):
    """Na BD fica `enc:<token Fernet>`; em Python é texto simples. Não indexável nem pesquisável."""

    def from_db_value(self, value, expression, connection):
        return decrypt(value) if value is not None else value

    def get_prep_value(self, value):
        return encrypt(value) if value else value

    def to_python(self, value):
        return decrypt(value) if isinstance(value, str) else value


if __name__ == "__main__":
    import django
    from django.conf import settings as s

    s.configure(FIELD_ENCRYPTION_KEYS=[Fernet.generate_key().decode()])
    django.setup()
    t = encrypt("JBSWY3DPEHPK3PXP")
    assert t.startswith(PREFIX) and "JBSWY3DP" not in t and decrypt(t) == "JBSWY3DPEHPK3PXP"
    assert decrypt("legado") == "legado"
    print("ok")
