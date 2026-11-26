"""Fotografe e pague: lê o texto de uma fatura e propõe serviço, campos, valor e prazo.

OCR: Tesseract (gratuito, local; `apt-get install tesseract-ocr tesseract-ocr-por`). Sem Tesseract
o endpoint aceita o texto já lido (`text`). A interpretação é por regras: palavras de cada instituição
(as mesmas da pesquisa) e os padrões dos campos que o catálogo já valida. Nada sai do servidor.
"""

import re
import shutil
from datetime import date

from catalog.search import ALIASES, norm

# Palavras que distinguem serviços da mesma instituição.
SERVICE_HINTS: dict[str, list[str]] = {
    "credelec": ["credelec", "recarga", "pre pago", "token", "kwh", "contador"],
    "fatura": ["fatura", "factura", "pos pago", "consumo", "periodo"],
    "multas": ["multa", "infraccao", "infracao", "auto", "matricula"],
}
AMOUNT_LABELS = r"(?:total(?:\s+a\s+pagar)?|valor(?:\s+a\s+pagar)?|montante|a\s+pagar|saldo\s+devedor)"
DATE_LABELS = r"(?:venc\w*|prazo|data\s+limite|pagar\s+at[eé]|limite)"


class OcrUnavailable(Exception):
    pass


def ocr(image_file) -> str:
    """Texto da imagem com Tesseract (português + inglês)."""
    if not shutil.which("tesseract"):
        raise OcrUnavailable("O leitor de faturas (Tesseract) não está instalado no servidor.")
    import pytesseract
    from PIL import Image, ImageOps

    im = ImageOps.exif_transpose(Image.open(image_file)).convert("L")
    if im.width < 1400:  # o Tesseract lê melhor letras maiores
        im = im.resize((1400, round(im.height * 1400 / im.width)))
    langs = "por+eng" if "por" in pytesseract.get_languages(config="") else "eng"
    return pytesseract.image_to_string(im, lang=langs)


def _amount(text: str) -> int | None:
    """'Total a pagar: 1.240,00 MT' -> 124000 centavos. Prefere o valor junto de uma etiqueta."""
    num = r"(\d{1,3}(?:[ .]\d{3})*(?:,\d{2})|\d+(?:,\d{2}))"
    m = re.search(AMOUNT_LABELS + r"[^\d\n]{0,25}" + num, text, re.I) or re.search(num + r"\s*(?:MT|MZN|Mt)\b", text)
    if not m:
        return None
    v = m.group(1).replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return round(float(v) * 100)
    except ValueError:
        return None


def _due(text: str) -> str | None:
    m = re.search(DATE_LABELS + r"[^\d\n]{0,20}(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})", text, re.I)
    if not m:
        return None
    d, mth, y = (int(x) for x in m.groups())
    y += 2000 if y < 100 else 0
    try:
        return date(y, mth, d).isoformat()
    except ValueError:
        return None


def _field_value(field: dict, text: str) -> str | None:
    """Procura um valor que cumpra o padrão do campo, de preferência perto da sua etiqueta."""
    pat = field.get("pattern")
    if not pat:
        return None
    core = pat.strip("^$")
    rx = re.compile(r"(?<![\w])(" + core + r")(?![\w])", re.I)
    label = norm(field.get("label", "")).split()
    lines = text.splitlines()
    candidates: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        squeezed = re.sub(r"(?<=\d)[ .](?=\d)", "", line)  # "1234 5678 901" -> "12345678901"
        for src in {line, squeezed}:
            for m in rx.finditer(src):
                near = norm(" ".join(lines[max(0, i - 1) : i + 1]))
                score = sum(1 for w in label if len(w) > 3 and w in near)
                candidates.append((score, m.group(1)))
    if not candidates:
        return None
    return (
        max(candidates, key=lambda c: c[0])[1].upper()
        if field["name"] == "matricula"
        else max(candidates, key=lambda c: c[0])[1]
    )


def interpret(text: str, services) -> dict:
    """Escolhe o serviço mais provável e preenche o que conseguir. `confidence` vai de 0 a 1."""
    t = norm(text)
    words = set(t.split())

    def hits(terms):
        return sum(1 for w in terms if (w in words if " " not in w else w in t))

    best, best_score = None, 0.0
    for s in services:
        inst = s.institution
        score = hits(ALIASES.get(inst.slug, [])) * 2 + hits(norm(inst.name).split()) * 0.5
        score += hits(SERVICE_HINTS.get(s.slug, [])) * 1.5 + hits(norm(s.name).split())
        if score > best_score:
            best, best_score = s, score
    if not best or best_score < 2:
        return {"service": None, "confidence": 0.0, "fields": {}, "amount": _amount(text), "due_date": _due(text)}

    fields = {
        f["name"]: v
        for f in best.fields or []
        if f.get("type") not in ("file", "select") and (v := _field_value(f, text))
    }
    wanted = [f for f in best.fields or [] if f.get("required", True) and f.get("type") not in ("file", "select")]
    filled = sum(1 for f in wanted if f["name"] in fields)
    confidence = min(1.0, 0.4 + 0.1 * min(best_score, 4) + (0.3 * filled / len(wanted) if wanted else 0.3))
    return {
        "service": best.id, "service_name": best.name, "institution_name": best.institution.name,
        "fields": fields, "amount": _amount(text), "due_date": _due(text), "confidence": round(confidence, 2),
    }  # fmt: skip
