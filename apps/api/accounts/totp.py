"""TOTP (RFC 6238) com stdlib: compatível com Google Authenticator, Microsoft Authenticator, Aegis…"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

STEP = 30
DIGITS = 6


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _code(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    off = digest[-1] & 0x0F
    n = struct.unpack(">I", digest[off : off + 4])[0] & 0x7FFFFFFF
    return f"{n % 10**DIGITS:0{DIGITS}d}"


def now_code(secret: str, at: float | None = None) -> str:
    return _code(secret, int((at or time.time()) // STEP))


def verify(secret: str, code: str, at: float | None = None, window: int = 1) -> int | None:
    """Devolve o contador aceite (para impedir reutilização) ou None. Tolera ±1 passo de relógio."""
    if not secret or not code.isdigit() or len(code) != DIGITS:
        return None
    t = int((at or time.time()) // STEP)
    for c in range(t - window, t + window + 1):
        if hmac.compare_digest(_code(secret, c), code):
            return c
    return None


def uri(secret: str, account: str, issuer: str = "PagaMOZ") -> str:
    return f"otpauth://totp/{quote(issuer)}:{quote(account)}?secret={secret}&issuer={quote(issuer)}&digits={DIGITS}"


if __name__ == "__main__":
    # Vector do RFC 6238 (SHA1, T=59 -> 94287082, 8 dígitos -> últimos 6: 287082)
    s = base64.b32encode(b"12345678901234567890").decode()
    assert _code(s, 59 // 30) == "287082"
    assert verify(s, "287082", at=59) == 1
    print("ok")
