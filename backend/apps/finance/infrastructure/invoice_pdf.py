import io
import os
from decimal import ROUND_HALF_UP, Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .issuer import (
    BANK_ACCOUNTS_NOTE,
    COMPANY_ADDRESS,
    COMPANY_CITY_TAX_NOTE,
    COMPANY_EMAIL,
    COMPANY_NAME,
    COMPANY_NIT,
    COMPANY_PHONE,
    DIAN_RESOLUTION,
    EXEMPT_GOODS_NOTICE,
    LEGAL_NOTICE,
)
from .qr import build_invoice_qr_image

CENTS = Decimal("0.01")
LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "logo.jpeg")

UNITS = (
    "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE",
    "DIECIOCHO", "DIECINUEVE",
)
TENS = (
    "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA",
    "OCHENTA", "NOVENTA",
)
HUNDREDS = (
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
    "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
)


def _money(value):
    return f"{value:,.2f}"


def _base_from_total(total, tax_rate):
    divisor = Decimal("1") + (tax_rate / Decimal("100"))
    return (total / divisor).quantize(CENTS, rounding=ROUND_HALF_UP)


def _hundreds_to_words(number):
    if number == 0:
        return ""
    if number == 100:
        return "CIEN"
    hundred, rest = divmod(number, 100)
    parts = [HUNDREDS[hundred]] if hundred else []
    if rest:
        if rest < 20:
            parts.append(UNITS[rest])
        else:
            ten, unit = divmod(rest, 10)
            tens_word = TENS[ten]
            if unit:
                tens_word = f"{tens_word} Y {UNITS[unit]}" if ten else UNITS[unit]
            parts.append(tens_word)
    return " ".join(parts)


def _thousands_to_words(number):
    if number == 0:
        return "CERO"
    millions, remainder = divmod(number, 1_000_000)
    thousands, hundreds = divmod(remainder, 1000)
    parts = []
    if millions:
        prefix = "UN MILLON" if millions == 1 else f"{_hundreds_to_words(millions)} MILLONES"
        parts.append(prefix)
    if thousands:
        prefix = "MIL" if thousands == 1 else f"{_hundreds_to_words(thousands)} MIL"
        parts.append(prefix)
    if hundreds:
        parts.append(_hundreds_to_words(hundreds))
    return " ".join(parts)


def _amount_in_words(total, currency):
    integer_part = int(total.to_integral_value(rounding=ROUND_HALF_UP))
    return f"SON: {_thousands_to_words(integer_part)} {currency} M/L"


def render_invoice_pdf(invoice):
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=28,
        bottomMargin=28,
        leftMargin=28,
        rightMargin=28,
        title=f"Factura {invoice.number}",
    )
    styles = getSampleStyleSheet()
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, leading=10)
    tax_rate = invoice.tax_rate

    logo = Image(LOGO_PATH, width=2.6 * cm, height=2.6 * cm) if os.path.exists(LOGO_PATH) else Spacer(1, 1)
    header_info = [
        Paragraph(f"<b>{COMPANY_NAME}</b>", styles["Normal"]),
        Paragraph(f"NIT: {COMPANY_NIT} - RESPONSABLE DE IVA", small),
        Paragraph(f"DIR: {COMPANY_ADDRESS}", small),
        Paragraph(f"TEL: {COMPANY_PHONE} - {COMPANY_EMAIL}", small),
        Paragraph(COMPANY_CITY_TAX_NOTE, small),
    ]
    header_title = [
        Paragraph("FACTURA ELECTRONICA DE VENTA", styles["Heading3"]),
        Paragraph(f"<b>{invoice.number}</b>", styles["Normal"]),
        Paragraph("Original", small),
        Paragraph("Pág: 1 de 1", small),
    ]
    header_table = Table(
        [[logo, header_info, header_title]],
        colWidths=[3 * cm, 9.5 * cm, 4.5 * cm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (2, 0), (2, 0), "RIGHT"),
    ]))

    elements = [
        header_table,
        Spacer(1, 6),
        Paragraph(DIAN_RESOLUTION, small),
        Spacer(1, 10),
    ]

    info_rows = [
        ["Nombre / Razón Social:", invoice.customer_name],
        ["Nit / C.C.:", invoice.customer_document],
        ["Dirección:", invoice.billing_address or "-"],
        ["Teléfono:", getattr(invoice.order, "customer_phone", None) or "-"],
        ["Email:", invoice.customer_email],
        ["Fecha Generación:", invoice.created_at.strftime("%Y-%m-%d %H:%M")],
        ["Fecha Expedición:", invoice.issued_at.strftime("%Y-%m-%d %H:%M")],
        ["Forma de Pago:", invoice.payment.payment_method or "-"],
        ["Pedido:", invoice.order.number],
        ["Ciudad:", getattr(invoice.order, "shipping_city", None) or "-"],
        ["Barrio:", getattr(invoice.order, "shipping_neighborhood", None) or "-"],
        ["Vendedor:", getattr(invoice.order, "salesperson", None) or "-"],
        ["Estado:", invoice.get_status_display()],
    ]
    info_table = Table(info_rows, colWidths=[4.5 * cm, 12.5 * cm])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 12))

    line_rows = [["Código", "Cantidad", "Und", "Descripción del Producto", "IVA", "Valor Unitario", "Total"]]
    for line in invoice.lines.all():
        line_rows.append([
            line.sku,
            str(line.quantity),
            "UND",
            line.product_name,
            f"{tax_rate:.0f}%",
            _money(line.unit_price),
            _money(line.subtotal),
        ])
    lines_table = Table(
        line_rows,
        colWidths=[2 * cm, 1.6 * cm, 1.3 * cm, 6.6 * cm, 1.4 * cm, 2.8 * cm, 2.8 * cm],
    )
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(lines_table)
    elements.append(Spacer(1, 14))

    goods_base = _base_from_total(invoice.subtotal, tax_rate)
    goods_tax = invoice.subtotal - goods_base

    summary_left = [
        Paragraph(f"IVA = {tax_rate:.0f}% : {_money(goods_tax)} . BASE: {_money(goods_base)}", small),
        Spacer(1, 4),
        Paragraph(f"IMPORTANTE!!! {BANK_ACCOUNTS_NOTE}", small),
        Spacer(1, 4),
        Paragraph(_amount_in_words(invoice.total, invoice.currency), small),
        Spacer(1, 4),
        Paragraph("MEDIO DE PAGO: INSTRUMENTO NO DEFINIDO", small),
        Spacer(1, 4),
        Paragraph("RETENCIONES: RETEFUENTE: 0.00  RETEICA: 0.00  RETEIVA: 0.00", small),
    ]
    totals_rows = [
        ["Base gravable", _money(goods_base)],
        [f"IVA ({tax_rate:.0f}%)", _money(goods_tax)],
        ["Subtotal", _money(invoice.subtotal)],
        ["Envío", _money(invoice.shipping_cost)],
        ["Retenciones", "0.00"],
        ["TOTAL A PAGAR", _money(invoice.total)],
    ]
    totals_table = Table(totals_rows, colWidths=[3.5 * cm, 3 * cm])
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.black),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
    ]))

    qr_buffer = build_invoice_qr_image(invoice)
    qr_image = Image(qr_buffer, width=3.2 * cm, height=3.2 * cm)
    cufe_style = ParagraphStyle("cufe", parent=small, fontSize=6, leading=7, wordWrap="CJK")
    qr_block = [
        qr_image,
        Spacer(1, 4),
        Paragraph(f"CUFE: {invoice.cufe}", cufe_style),
    ]

    summary_table = Table(
        [[summary_left, totals_table, "", qr_block]],
        colWidths=[7.5 * cm, 4.5 * cm, 0.8 * cm, 3.7 * cm],
    )
    summary_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (3, 0), (3, 0), "CENTER"),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 16))

    signature_rows = [
        ["FIRMA Y SELLO DEL CLIENTE:", "FIRMA Y SELLO - DESPACHO / VENDEDOR:"],
        ["RECIBI CONFORME Y ACEPTO EL CONTENIDO", "C.C./NIT:"],
    ]
    signature_table = Table(signature_rows, colWidths=[9 * cm, 9 * cm], rowHeights=[28, 14])
    signature_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (0, 0), 0.5, colors.black),
        ("BOX", (1, 0), (1, 0), 0.5, colors.black),
    ]))
    elements.append(signature_table)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph(LEGAL_NOTICE, small))
    elements.append(Paragraph(EXEMPT_GOODS_NOTICE, small))

    document.build(elements)
    buffer.seek(0)
    return buffer
