"""Identidade de cada instituição no comprovativo: o logótipo e a cor principal, tirada do próprio logótipo.

Os logótipos são os de apps/web/public/logos (ver LEIA-ME.md lá). Raster (png/jpg/webp) entra no PDF;
de um SVG só se aproveita a cor (o reportlab não desenha SVG sem dependências extra).
"""

import colorsys
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from PIL import Image

INK = (11, 11, 12)


def logo_dir() -> Path:
    return Path(getattr(settings, "RECEIPT_LOGO_DIR", settings.BASE_DIR.parent / "web" / "public" / "logos"))


@dataclass(frozen=True)
class Brand:
    color: tuple[int, int, int]
    logo: Path | None  # raster, para desenhar

    @property
    def on_color(self) -> tuple[int, int, int]:
        """Texto legível por cima da cor (branco em cores escuras, tinta nas claras)."""
        r, g, b = (c / 255 for c in self.color)
        return (255, 255, 255) if 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.6 else INK


def _vivid(rgb: tuple[int, int, int]) -> bool:
    _, light, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return s > 0.35 and 0.18 < light < 0.82  # nem branco, nem preto, nem cinzento


def color_from_raster(path: Path) -> tuple[int, int, int] | None:
    im = Image.open(path).convert("RGBA")
    im.thumbnail((96, 96))
    counts: Counter = Counter()
    for r, g, b, a in im.getdata():
        if a > 200 and _vivid((r, g, b)):
            # cores mais vivas pesam mais (um emblema com zonas claras não fica bege)
            s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)[2]
            counts[(r // 16 * 16 + 8, g // 16 * 16 + 8, b // 16 * 16 + 8)] += s * s
    return counts.most_common(1)[0][0] if counts else None


def color_from_svg(path: Path) -> tuple[int, int, int] | None:
    found = re.findall(r"#([0-9a-fA-F]{6})\b", path.read_text("utf-8", errors="ignore"))
    rgbs = [tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) for h in found]
    vivid = [c for c in rgbs if _vivid(c)]
    return Counter(vivid).most_common(1)[0][0] if vivid else None


@lru_cache(maxsize=64)
def brand(slug: str) -> Brand:
    d = logo_dir()
    for ext in ("png", "jpg", "webp"):
        p = d / f"{slug}.{ext}"
        if p.exists():
            return Brand(color_from_raster(p) or INK, p)
    p = d / f"{slug}.svg"
    if p.exists():
        return Brand(color_from_svg(p) or INK, None)
    return Brand(INK, None)


if __name__ == "__main__":
    assert _vivid((224, 38, 47)) and not _vivid((250, 250, 250)) and not _vivid((128, 128, 128))
    assert Brand((240, 200, 40), None).on_color == INK and Brand((10, 60, 120), None).on_color == (255, 255, 255)
    print("ok")
