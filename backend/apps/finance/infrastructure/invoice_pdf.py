import io
from decimal import ROUND_HALF_UP, Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .issuer import (
    BANK_ACCOUNTS_NOTE,
    COMPANY_ADDRESS,
    COMPANY_CITY_TAX_NOTE,
    COMPANY_EMAIL,
    COMPANY_NAME,
    COMPANY_NIT,
    COMPANY_PHONE,
    EXEMPT_GOODS_NOTICE,
    LEGAL_NOTICE,
)

CENTS = Decimal("0.01")


def _money(value):
    return f"{value:,.2f}"


def _base_from_total(total, tax_rate):
    divisor = Decimal("1") + (tax_rate / Decimal("100"))
    return (total / divisor).quantize(CENTS, rounding=ROUND_HALF_UP)


def render_invoice_pdf(invoice):
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=36,
        bottomMargin=36,
        title=f"Factura {invoice.number}",
    )
    styles = getSampleStyleSheet()
    tax_rate = invoice.tax_rate

    elements = [
        Paragraph(COMPANY_NAME, styles["Title"]),
        Paragraph(f"NIT: {COMPANY_NIT} - RESPONSABLE DE IVA", styles["Normal"]),
        Paragraph(f"DIR: {COMPANY_ADDRESS}", styles["Normal"]),
        Paragraph(f"TEL: {COMPANY_PHONE} - {COMPANY_EMAIL}", styles["Normal"]),
        Paragraph(COMPANY_CITY_TAX_NOTE, styles["Normal"]),
        Spacer(1, 8),
        Paragraph(f"FACTURA ELECTRONICA DE VENTA {invoice.number}", styles["Heading2"]),
        Paragraph(invoice.dian_resolution, styles["Normal"]),
        Spacer(1, 12),
    ]

    info_rows = [
        ["Pedido", invoice.order.number],
        ["Fecha de emisión", invoice.issued_at.strftime("%Y-%m-%d %H:%M")],
        ["Estado", invoice.get_status_display()],
        ["Cliente", invoice.customer_name],
        ["Documento", invoice.customer_document],
        ["Email", invoice.customer_email],
        ["Dirección de facturación", invoice.billing_address or "-"],
    ]
    info_table = Table(info_rows, colWidths=[5 * cm, 11 * cm])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 16))

    elements.append(Paragraph("Detalle", styles["Heading3"]))
    elements.append(Spacer(1, 6))
    line_rows = [["Producto", "SKU", "Cantidad", "Precio unitario", "IVA %", "Subtotal"]]
    for line in invoice.lines.all():
        line_rows.append([
            line.product_name,
            line.sku,
            str(line.quantity),
            _money(line.unit_price),
            f"{tax_rate:.0f}",
            _money(line.subtotal),
        ])
    lines_table = Table(line_rows, colWidths=[5 * cm, 2.5 * cm, 2 * cm, 2.5 * cm, 1.5 * cm, 2.5 * cm])
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(lines_table)
    elements.append(Spacer(1, 16))

    goods_base = _base_from_total(invoice.subtotal, tax_rate)
    goods_tax = invoice.subtotal - goods_base

    totals_rows = [
        ["Base gravable", f"{invoice.currency} {_money(goods_base)}"],
        [f"IVA ({tax_rate:.0f}%)", f"{invoice.currency} {_money(goods_tax)}"],
        ["Subtotal", f"{invoice.currency} {_money(invoice.subtotal)}"],
        ["Envío", f"{invoice.currency} {_money(invoice.shipping_cost)}"],
        ["Total", f"{invoice.currency} {_money(invoice.total)}"],
    ]
    totals_table = Table(totals_rows, colWidths=[13 * cm, 4 * cm])
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.black),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 16))

    elements.append(Paragraph(f"IMPORTANTE!!! {BANK_ACCOUNTS_NOTE}", styles["Normal"]))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(LEGAL_NOTICE, styles["Normal"]))
    elements.append(Paragraph(EXEMPT_GOODS_NOTICE, styles["Normal"]))

    document.build(elements)
    buffer.seek(0)
    return buffer
