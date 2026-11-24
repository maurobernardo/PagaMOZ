"""PDF do comprovativo. Determinístico (invariant=1): o mesmo conteúdo dá sempre os mesmos bytes."""

import io

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas

BRAND = HexColor("#0b3d2e")
MUTED = HexColor("#475569")


def mzn(centavos: int) -> str:
    s = f"{centavos / 100:,.2f}"  # 1,234.56
    return s.replace(",", " ").replace(".", ",") + " MT"


def _qr(c: Canvas, data: str, x: float, y: float, size: float):
    w = QrCodeWidget(data, barLevel="M")
    x0, y0, x1, y1 = w.getBounds()
    d = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    d.add(w)
    renderPDF.draw(d, c, x, y)


def render(content: dict, verify_url: str, demo: bool, compress: bool = True) -> bytes:
    buf = io.BytesIO()
    W, H = A5
    c = Canvas(buf, pagesize=A5, invariant=1, pageCompression=int(compress))
    c.setTitle(f"Comprovativo {content['referencia']}")
    c.setAuthor("PagaMOZ")
    c.setSubject("Comprovativo de pagamento")

    # Cabeçalho
    c.setFillColor(BRAND)
    c.rect(0, H - 28 * mm, W, 28 * mm, stroke=0, fill=1)
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(12 * mm, H - 14 * mm, "PagaMOZ")
    c.setFont("Helvetica", 9)
    c.drawString(12 * mm, H - 20 * mm, "Comprovativo de pagamento")
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(W - 12 * mm, H - 14 * mm, content["estado"])

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
    y = H - 40 * mm
    for label, value in rows:
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        c.drawString(12 * mm, y, label)
        c.setFont("Helvetica", 9.5)
        c.setFillColor(HexColor("#0f172a"))
        c.drawRightString(W - 12 * mm, y, str(value)[:70])
        y -= 7 * mm
    c.setStrokeColor(HexColor("#e2e8f0"))
    c.line(12 * mm, y + 3 * mm, W - 12 * mm, y + 3 * mm)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(12 * mm, y - 4 * mm, "Total pago")
    c.drawRightString(W - 12 * mm, y - 4 * mm, mzn(content["total"]))

    # Verificação
    qr = 34 * mm
    _qr(c, verify_url, 12 * mm, 16 * mm, qr)
    tx = 12 * mm + qr + 5 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(HexColor("#0f172a"))
    c.drawString(tx, 44 * mm, "Verifique a autenticidade")
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(tx, 39 * mm, "Leia o QR ou abra:")
    c.drawString(tx, 35 * mm, verify_url.split("/verificar/")[0] + "/verificar")
    c.drawString(tx, 30 * mm, "Código de verificação:")
    c.setFont("Courier-Bold", 12)
    c.setFillColor(HexColor("#0f172a"))
    c.drawString(tx, 24 * mm, content["codigo"])
    c.setFont("Helvetica", 6)
    c.setFillColor(MUTED)
    c.drawString(12 * mm, 10 * mm, f"Hash do conteúdo: {content['_hash']}")
    c.drawString(
        12 * mm, 7 * mm, "O valor é liquidado directamente na conta da instituição. O PagaMOZ não retém fundos."
    )

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
