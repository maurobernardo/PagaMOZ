"""PDF do comprovativo. Determinístico (invariant=1): o mesmo conteúdo dá sempre os mesmos bytes."""

import io

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas

from .branding import INK, Brand

MUTED = HexColor("#6e6e6a")
TEXT = HexColor("#0b0b0c")


def _rgb(c: tuple[int, int, int], alpha: float = 1) -> Color:
    return Color(c[0] / 255, c[1] / 255, c[2] / 255, alpha=alpha)


def _mark(c: Canvas, x: float, y: float, size: float, color: Color):
    """O "P" da PagaMOZ com o visto vermelho (mesmo desenho do logótipo, viewBox 40)."""
    k = size / 40
    c.saveState()
    c.translate(x, y + size)
    c.scale(k, -k)
    c.setLineCap(1)
    c.setLineJoin(1)
    c.setStrokeColor(color)
    c.setLineWidth(4.2)
    p = c.beginPath()
    p.moveTo(13, 31)
    p.lineTo(13, 9)
    p.lineTo(21.5, 9)
    p.arcTo(14, 9, 29, 24, startAng=-90, extent=180)
    p.lineTo(17, 24)
    c.drawPath(p, stroke=1, fill=0)
    c.setStrokeColor(HexColor("#e0262f"))
    c.setLineWidth(2.4)
    p = c.beginPath()
    p.moveTo(18.3, 16.7)
    p.lineTo(20.4, 18.8)
    p.lineTo(24, 15)
    c.drawPath(p, stroke=1, fill=0)
    c.restoreState()


def mzn(centavos: int) -> str:
    s = f"{centavos / 100:,.2f}"  # 1,234.56
    return s.replace(",", " ").replace(".", ",") + " MT"


def _qr(c: Canvas, data: str, x: float, y: float, size: float):
    w = QrCodeWidget(data, barLevel="M")
    x0, y0, x1, y1 = w.getBounds()
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(w)
    renderPDF.draw(d, c, x, y)


def render(content: dict, verify_url: str, demo: bool, compress: bool = True, brand: Brand | None = None) -> bytes:
    brand = brand or Brand(INK, None)
    BRAND = _rgb(brand.color)
    ON = _rgb(brand.on_color)
    buf = io.BytesIO()
    W, H = A5
    c = Canvas(buf, pagesize=A5, invariant=1, pageCompression=int(compress))
    c.setTitle(f"Comprovativo {content['referencia']}")
    c.setAuthor("PagaMOZ")
    c.setSubject("Comprovativo de pagamento")

    # Cabeçalho na cor da instituição, com o logótipo num cartão branco
    band = 34 * mm
    c.setFillColor(BRAND)
    c.rect(0, H - band, W, band, stroke=0, fill=1)
    plate = 20 * mm
    px, py = 12 * mm, H - band + (band - plate) / 2
    c.setFillColor(HexColor("#ffffff"))
    c.roundRect(px, py, plate, plate, 4 * mm, stroke=0, fill=1)
    if brand.logo:
        c.drawImage(
            ImageReader(str(brand.logo)),
            px + 2 * mm,
            py + 2 * mm,
            plate - 4 * mm,
            plate - 4 * mm,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )
    else:
        initials = "".join(
            w[0] for w in content["instituicao"].replace("(", " ").split()[:2] if w[:1].isalpha()
        ).upper()
        c.setFillColor(BRAND)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(px + plate / 2, py + plate / 2 - 5, initials)
    tx = px + plate + 5 * mm
    c.setFillColor(ON)
    c.setFont("Helvetica-Bold", 12)
    name = content["instituicao"]
    c.drawString(tx, H - 15 * mm, name if len(name) <= 38 else name[:36] + "…")
    c.setFont("Helvetica", 9)
    c.drawString(tx, H - 21 * mm, "Comprovativo de pagamento")
    # selo do estado
    st = content["estado"]
    c.setFont("Helvetica-Bold", 8.5)
    sw = c.stringWidth(st, "Helvetica-Bold", 8.5) + 8 * mm
    c.setFillColor(HexColor("#ffffff"))
    c.roundRect(tx, H - 30 * mm, sw, 6 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(BRAND if brand.on_color != INK else TEXT)
    c.drawString(tx + 4 * mm, H - 28 * mm, st)

    # Linhas
    rows = [
        ("Referência", content["referencia"]),
        ("Instituição", content["instituicao"]),
        ("Serviço", content["servico"]),
        ("Detalhe", content["detalhe"]),
        ("Método", content["metodo"]),
        ("Data e hora", content["data_hora"]),
        ("Valor", mzn(content["valor"])),
        ("Comissão", f"{mzn(content['comissao'])} ({content['comissao_paga_por']})"),
    ]
    if content.get("entrega"):
        rows.append(tuple(content["entrega"]))
    y = H - 44 * mm
    for label, value in rows:
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        c.drawString(12 * mm, y, label)
        c.setFont("Helvetica", 9.5)
        c.setFillColor(TEXT)
        c.drawRightString(W - 12 * mm, y, str(value)[:70])
        y -= 7 * mm
    # Total num bloco na cor da instituição
    c.setFillColor(BRAND)
    c.roundRect(12 * mm, y - 9 * mm, W - 24 * mm, 13 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(ON)
    c.setFont("Helvetica", 10)
    c.drawString(17 * mm, y - 3.6 * mm, "Total pago")
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(W - 17 * mm, y - 4 * mm, mzn(content["total"]))

    # Verificação
    qr = 34 * mm
    _qr(c, verify_url, 12 * mm, 16 * mm, qr)
    tx = 12 * mm + qr + 5 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(TEXT)
    c.drawString(tx, 44 * mm, "Verifique a autenticidade")
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(tx, 39 * mm, "Leia o QR ou abra:")
    c.drawString(tx, 35 * mm, verify_url.split("/verificar/")[0] + "/verificar")
    c.drawString(tx, 30 * mm, "Código de verificação:")
    c.setFont("Courier-Bold", 12)
    c.setFillColor(BRAND if brand.on_color != INK else TEXT)
    c.drawString(tx, 24 * mm, content["codigo"])
    c.setFont("Helvetica", 6)
    c.setFillColor(MUTED)
    c.drawString(12 * mm, 10 * mm, f"Hash do conteúdo: {content['_hash']}")
    c.drawString(
        12 * mm, 7 * mm, "O valor é liquidado directamente na conta da instituição. O PagaMOZ não retém fundos."
    )

    # Assinatura PagaMOZ e uma risca fina na cor da instituição
    _mark(c, W - 12 * mm - 7 * mm, 15.5 * mm, 7 * mm, TEXT)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(TEXT)
    c.drawRightString(W - 12 * mm, 13 * mm, "PagaMOZ")
    c.setFillColor(BRAND)
    c.rect(0, 0, W, 2.2 * mm, stroke=0, fill=1)

    if demo:
        c.saveState()
        c.setFillColor(Color(0.85, 0.1, 0.1, alpha=0.18))
        c.setFont("Helvetica-Bold", 44)
        c.translate(W / 2, H / 2)
        c.rotate(35)
        c.drawCentredString(0, 0, "DEMONSTRAÇÃO")
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(0, -10 * mm, "Sem valor legal · pagamento simulado")
        c.restoreState()

    c.showPage()
    c.save()
    return buf.getvalue()
