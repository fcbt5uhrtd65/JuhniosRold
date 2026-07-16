import io
import json
import os
from decimal import ROUND_HALF_UP, Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

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
PESO = Decimal("1")
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


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _format_address(raw_address):
    raw_address = _safe(raw_address, "")
    if not raw_address:
        return "-"

    try:
        data = json.loads(raw_address)
    except (TypeError, ValueError):
        return raw_address

    if not isinstance(data, dict):
        return raw_address

    line1 = _safe(data.get("address_line1"), "")
    line2 = _safe(data.get("address_line2"), "")
    city = _safe(data.get("city"), "")
    department = _safe(data.get("department"), "")

    street = " - ".join(part for part in (line1, line2) if part)
    locality = ", ".join(part for part in (city, department) if part)

    formatted = " ".join(part for part in (street, locality) if part)
    return formatted or "-"


def _money(value, decimals=False):
    value = Decimal(value or 0)
    if decimals:
        return f"{value.quantize(CENTS, rounding=ROUND_HALF_UP):,.2f}"
    return f"{value.quantize(PESO, rounding=ROUND_HALF_UP):,.0f}".replace(",", ".")


def _base_from_total(total, tax_rate):
    total = Decimal(total or 0)
    tax_rate = Decimal(tax_rate or 0)
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
        parts.append("UN MILLON" if millions == 1 else f"{_hundreds_to_words(millions)} MILLONES")

    if thousands:
        parts.append("MIL" if thousands == 1 else f"{_hundreds_to_words(thousands)} MIL")

    if hundreds:
        parts.append(_hundreds_to_words(hundreds))

    return " ".join(parts)


def _amount_in_words(total, currency):
    total = Decimal(total or 0)
    integer_part = int(total.to_integral_value(rounding=ROUND_HALF_UP))
    return f"SON: {_thousands_to_words(integer_part)} {currency} M/L"


def _font(bold=False):
    return "Helvetica-Bold" if bold else "Helvetica"


def _draw_text(c, x, y, text, size=7, bold=False, align="left"):
    c.setFont(_font(bold), size)
    text = _safe(text, "")

    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def _fit_text(text, max_width, font_name="Helvetica", font_size=7):
    text = _safe(text, "")
    if stringWidth(text, font_name, font_size) <= max_width:
        return text

    suffix = "..."
    while text and stringWidth(text + suffix, font_name, font_size) > max_width:
        text = text[:-1]

    return text + suffix if text else suffix


def _wrap_lines(text, max_width, font_name="Helvetica", font_size=7):
    text = _safe(text, "")
    words = text.split()
    lines = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)

    return lines


def _draw_wrapped_text(c, x, y, text, max_width, size=7, bold=False, leading=None, max_lines=None):
    font_name = _font(bold)
    leading = leading or size + 2
    lines = _wrap_lines(text, max_width, font_name, size)

    truncated = bool(max_lines) and len(lines) > max_lines
    if max_lines:
        lines = lines[:max_lines]
    if truncated and lines:
        lines[-1] = _fit_text(f"{lines[-1]} …", max_width, font_name, size)

    c.setFont(font_name, size)
    for idx, line in enumerate(lines):
        c.drawString(x, y - (idx * leading), line)


def _draw_label_value(c, x, y, label, value, label_w=68, size=6.5, max_width=150):
    _draw_text(c, x, y, label, size=size, bold=True)
    _draw_text(c, x + label_w, y, _fit_text(value, max_width, font_size=size), size=size)


def _draw_rect(c, x, y, w, h, radius=0):
    if radius:
        c.roundRect(x, y, w, h, radius, stroke=1, fill=0)
    else:
        c.rect(x, y, w, h, stroke=1, fill=0)


def render_invoice_pdf(invoice):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Factura {invoice.number}")

    page_w, page_h = letter
    tax_rate = Decimal(invoice.tax_rate or 0)

    order = invoice.order
    payment = invoice.payment

    # Medidas principales
    x0 = 12
    x1 = page_w - 12
    main_w = x1 - x0

    # ---------------------------------------------------------------------
    # Encabezado superior
    # ---------------------------------------------------------------------
    if os.path.exists(LOGO_PATH):
        c.drawImage(
            LOGO_PATH,
            x0 + 8,
            670,
            width=110,
            height=80,
            preserveAspectRatio=True,
            mask="auto",
        )

    center_x = page_w / 2
    y = 760
    _draw_text(c, center_x, y, COMPANY_NAME.upper(), size=7.5, bold=True, align="center")
    _draw_text(c, center_x, y - 22, f"NIT: {COMPANY_NIT}", size=7, bold=True, align="center")
    _draw_text(c, center_x, y - 36, "RESPONSABLE DE IVA", size=6, align="center")
    _draw_text(c, center_x, y - 50, f"DIR: {COMPANY_ADDRESS}", size=6, bold=True, align="center")
    _draw_text(c, center_x, y - 62, f"TEL:{COMPANY_PHONE}", size=6, bold=True, align="center")
    _draw_text(c, center_x, y - 74, COMPANY_EMAIL, size=6, bold=True, align="center")
    _draw_text(c, center_x, y - 88, COMPANY_CITY_TAX_NOTE, size=5.5, align="center")
    _draw_text(c, center_x, y - 101, "TRIBUTAMOS EN BARRANQUILLA", size=5.5, align="center")

    _draw_text(c, 448, 765, "Original (REIMP)", size=6)
    _draw_text(c, 588, 765, "Pág: 1 de 1", size=6, align="right")

    _draw_rect(c, 448, 704, 152, 52, radius=8)
    _draw_text(c, 524, 737, "FACTURA ELECTRONICA DE VENTA", size=7, bold=True, align="center")
    _draw_text(c, 524, 719, str(invoice.number), size=8, bold=True, align="center")

    _draw_wrapped_text(
        c,
        450,
        696,
        DIAN_RESOLUTION,
        max_width=145,
        size=5.2,
        bold=False,
        leading=6,
        max_lines=5,
    )

    # ---------------------------------------------------------------------
    # Bloque cliente / factura
    # ---------------------------------------------------------------------
    info_y = 563
    info_h = 92

    _draw_rect(c, x0, info_y, 366, info_h, radius=8)
    _draw_rect(c, x0 + 366, info_y, main_w - 366, info_h, radius=8)

    left_x = x0 + 5
    row_y = info_y + info_h - 12
    row_gap = 10.5

    left_col_w = 366 - 5 - 3 - 58
    left_narrow_w = 366 - 250 - 3 - 45
    right_col_w = main_w - 371 - 3 - 82
    right_narrow_w = main_w - 520 - 3 - 45

    razon_social = invoice.customer_business_name or invoice.customer_name
    _draw_label_value(c, left_x, row_y, "Nombre:", invoice.customer_name, label_w=58, max_width=left_col_w)
    _draw_label_value(c, left_x, row_y - row_gap, "Razón Social:", razon_social, label_w=58, max_width=left_col_w)
    _draw_label_value(c, left_x, row_y - row_gap * 2, "Nit / C.C.:", invoice.customer_document, label_w=58, max_width=left_col_w)
    _draw_text(c, left_x, row_y - row_gap * 3, "Dirección:", size=6.5, bold=True)
    _draw_wrapped_text(
        c,
        left_x + 58,
        row_y - row_gap * 3,
        _format_address(invoice.billing_address),
        max_width=left_col_w,
        size=6.5,
        leading=row_gap,
        max_lines=2,
    )

    _draw_label_value(c, left_x, row_y - row_gap * 5, "Barrio:", getattr(order, "shipping_neighborhood", None), label_w=58, max_width=left_col_w)
    _draw_label_value(c, left_x, row_y - row_gap * 6, "Ciudad:", getattr(order, "shipping_city", None), label_w=58, max_width=left_col_w)
    _draw_label_value(c, left_x, row_y - row_gap * 7, "Teléfono:", getattr(order, "customer_phone", None), label_w=58, max_width=left_col_w)

    _draw_label_value(c, x0 + 250, row_y - row_gap * 2, "Código:", getattr(order, "customer_code", None), label_w=45, max_width=left_narrow_w)
    _draw_label_value(c, x0 + 250, row_y - row_gap * 6, "Placa:", getattr(order, "plate", None), label_w=45, max_width=left_narrow_w)

    right_x = x0 + 371
    right_y = row_y

    _draw_label_value(c, right_x, right_y, "Fecha Generación:", invoice.created_at.strftime("%Y-%m-%d %H:%M"), label_w=82, max_width=right_col_w)
    _draw_label_value(c, right_x, right_y - row_gap, "Fecha Expedición:", invoice.issued_at.strftime("%Y-%m-%d %H:%M"), label_w=82, max_width=right_col_w)
    _draw_label_value(c, right_x, right_y - row_gap * 2, "Forma de Pago:", payment.payment_method or "-", label_w=82, max_width=right_col_w)
    _draw_label_value(c, right_x, right_y - row_gap * 3, "Vencimiento:", getattr(invoice, "due_date", None) or "-", label_w=82, max_width=right_col_w)
    _draw_label_value(c, right_x, right_y - row_gap * 4, "Pedido:", order.number, label_w=82, max_width=right_col_w)
    _draw_label_value(c, right_x, right_y - row_gap * 5, "Elaborada Por:", getattr(order, "created_by", None), label_w=82, max_width=right_col_w)
    _draw_label_value(c, right_x, right_y - row_gap * 6, "Vendedor:", getattr(order, "salesperson", None), label_w=82, max_width=right_col_w)

    _draw_label_value(c, x0 + 520, right_y - row_gap * 3, "Peso:", getattr(order, "weight", None), label_w=45, max_width=right_narrow_w)

    # ---------------------------------------------------------------------
    # Tabla de productos
    # ---------------------------------------------------------------------
    table_x = x0
    table_top = 558
    table_bottom = 505
    table_w = main_w
    header_h = 15

    _draw_rect(c, table_x, table_bottom, table_w, table_top - table_bottom)

    col_widths = [35, 52, 45, 280, 22, 80, 74]
    headers = ["Código", "Cantidad", "UndMedida", "Descripción del Producto", "IVA", "Valor Unitario", "Total"]

    cx = table_x
    for width in col_widths[:-1]:
        cx += width
        c.line(cx, table_bottom, cx, table_top)

    c.line(table_x, table_top - header_h, table_x + table_w, table_top - header_h)

    cx = table_x
    for header, width in zip(headers, col_widths):
        _draw_text(c, cx + width / 2, table_top - 10, header, size=5.8, bold=True, align="center")
        cx += width

    all_lines = list(invoice.lines.all())
    available_h = table_top - header_h - table_bottom - 4
    min_row_h = 9
    max_visible_lines = max(1, int(available_h // min_row_h))
    hidden_count = max(0, len(all_lines) - max_visible_lines)
    lines = all_lines[: max_visible_lines - 1] if hidden_count else all_lines[:max_visible_lines]
    row_h = 10 if len(lines) <= 3 else max(min_row_h, available_h / max(len(lines) + (1 if hidden_count else 0), 1))

    y = table_top - header_h - row_h + 2

    for line in lines:
        cx = table_x
        product_description = _safe(line.product_name, "")
        if getattr(line, "presentation", ""):
            product_description = f"{product_description} - {line.presentation}"

        qty = Decimal(line.quantity or 0)
        qty_str = str(int(qty)) if qty == qty.to_integral_value() else str(qty.normalize())

        values = [
            _safe(line.sku, ""),
            qty_str,
            "UND",
            product_description,
            f"{tax_rate:.0f}%",
            _money(line.unit_price),
            _money(line.subtotal),
        ]

        aligns = ["left", "right", "center", "left", "center", "right", "right"]

        for value, width, align in zip(values, col_widths, aligns):
            font_size = 5.8
            text = _fit_text(value, width - 4, font_size=font_size)

            if align == "right":
                _draw_text(c, cx + width - 3, y, text, size=font_size, align="right")
            elif align == "center":
                _draw_text(c, cx + width / 2, y, text, size=font_size, align="center")
            else:
                _draw_text(c, cx + 3, y, text, size=font_size)

            cx += width

        y -= row_h

        if y < table_bottom + 3:
            break

    if hidden_count:
        _draw_text(
            c,
            table_x + table_w / 2,
            y,
            f"+ {hidden_count} producto(s) adicional(es) — ver anexo de detalle",
            size=6,
            bold=True,
            align="center",
        )

    # ---------------------------------------------------------------------
    # Impuestos, bancos, letras y retenciones
    # ---------------------------------------------------------------------
    goods_base = _base_from_total(invoice.subtotal, tax_rate)
    goods_tax = Decimal(invoice.subtotal or 0) - goods_base

    current_y = table_bottom

    # Fila IVA
    tax_h = 16
    _draw_rect(c, x0, current_y - tax_h, main_w, tax_h)
    _draw_text(
        c,
        x0 + 5,
        current_y - 11,
        f"IVA= {tax_rate:.0f}% : {_money(goods_tax)} . BASE: {_money(goods_base)} -",
        size=6,
    )
    current_y -= tax_h

    # Fila bancos
    bank_h = 27
    _draw_rect(c, x0, current_y - bank_h, main_w, bank_h)
    _draw_wrapped_text(
        c,
        x0 + 22,
        current_y - 11,
        f"IMPORTANTE!!! {BANK_ACCOUNTS_NOTE}",
        max_width=main_w - 44,
        size=6.4,
        bold=True,
        leading=8,
        max_lines=2,
    )
    current_y -= bank_h

    # Fila valor en letras
    words_h = 23
    _draw_rect(c, x0, current_y - words_h, main_w, words_h)
    _draw_wrapped_text(
        c,
        x0 + 5,
        current_y - 14,
        _amount_in_words(invoice.total, invoice.currency),
        max_width=main_w - 10,
        size=5.8,
        leading=7,
        max_lines=2,
    )
    current_y -= words_h

    # Medio de pago
    payment_h = 23
    _draw_rect(c, x0, current_y - payment_h, main_w, payment_h)
    _draw_text(c, x0 + 5, current_y - 15, "MEDIO DE PAGO: INSTRUMENTO NO DEFINIDO", size=6.4, bold=True)
    current_y -= payment_h

    # Retenciones
    retention_h = 17
    _draw_rect(c, x0, current_y - retention_h, main_w, retention_h)
    _draw_text(
        c,
        x0 + 5,
        current_y - 11,
        "RETENCIONES: RETEFUENTE: 0.00  RETEICA: 0.00  RETEIVA: 0.00",
        size=6.2,
        bold=True,
    )
    _draw_text(c, x0 + 382, current_y - 11, "LINEAS:", size=6)
    _draw_text(c, x0 + 430, current_y - 11, str(len(lines)), size=6)
    current_y -= retention_h

    # ---------------------------------------------------------------------
    # Bloque inferior: despacho, QR, recibido, totales
    # ---------------------------------------------------------------------
    bottom_top = current_y
    bottom_bottom = 300
    bottom_h = bottom_top - bottom_bottom

    _draw_rect(c, x0, bottom_bottom, main_w, bottom_h)

    col1_w = 110
    col2_w = 105
    col3_w = 220
    col4_w = main_w - col1_w - col2_w - col3_w

    x_col1 = x0
    x_col2 = x_col1 + col1_w
    x_col3 = x_col2 + col2_w
    x_col4 = x_col3 + col3_w

    c.line(x_col2, bottom_bottom, x_col2, bottom_top)
    c.line(x_col3, bottom_bottom, x_col3, bottom_top)
    c.line(x_col4, bottom_bottom, x_col4, bottom_top)

    is_in_store_sale = getattr(order, "channel", None) == "IN_STORE"

    # Despacho / vendedor
    if is_in_store_sale:
        _draw_text(c, x_col1 + col1_w / 2, bottom_top - 10, "FIRMA Y SELLO", size=6.3, bold=True, align="center")
        _draw_text(c, x_col1 + col1_w / 2, bottom_top - 21, "DESPACHO / VENDEDOR", size=6.3, bold=True, align="center")
        _draw_text(c, x_col1 + 5, bottom_top - 45, "C.C./NIT: __________________", size=5.8)
        _draw_text(c, x_col1 + 5, bottom_top - 68, "No.Cajas Empaque: ________", size=5.8)
        _draw_text(c, x_col1 + 5, bottom_top - 84, "NDEF", size=5.8)
    else:
        _draw_text(c, x_col1 + col1_w / 2, bottom_top - 10, "VENTA VIRTUAL", size=6.3, bold=True, align="center")
        _draw_text(c, x_col1 + col1_w / 2, bottom_top - 21, "SIN DESPACHO EN TIENDA", size=6.3, bold=True, align="center")
        _draw_wrapped_text(
            c,
            x_col1 + 5,
            bottom_top - 38,
            "Pedido generado y pagado en linea a traves de la tienda virtual. "
            "No requiere vendedor ni firma de despacho.",
            max_width=col1_w - 10,
            size=5.4,
            leading=6.5,
            max_lines=5,
        )

    # QR
    try:
        qr_buffer = build_invoice_qr_image(invoice)
        qr_buffer.seek(0)
        c.drawImage(ImageReader(qr_buffer), x_col2 + 14, bottom_bottom + 14, width=78, height=78)
    except Exception:
        _draw_rect(c, x_col2 + 14, bottom_bottom + 14, 78, 78)
        _draw_text(c, x_col2 + col2_w / 2, bottom_bottom + 50, "QR", size=12, bold=True, align="center")

    # Recibido
    if is_in_store_sale:
        _draw_text(c, x_col3 + 5, bottom_top - 10, "RECIBI CONFORME Y ACEPTO EL CONTENIDO", size=6.3, bold=True)
        _draw_wrapped_text(
            c,
            x_col3 + 5,
            bottom_top - 24,
            "Se hace constar que la firma distinta del comprador implica autorizacion de este "
            "para que dicha persona acepte y confiese la deuda a cargo del comprador",
            max_width=col3_w - 10,
            size=5.4,
            leading=6,
            max_lines=4,
        )
        _draw_text(c, x_col3 + 5, bottom_bottom + 40, "NOMBRE: ______________________________", size=5.8)
        _draw_text(c, x_col3 + 5, bottom_bottom + 24, "CC: _____________ FECHA RECIBE: ____________", size=5.8)
        c.line(x_col3, bottom_bottom + 12, x_col3 + col3_w, bottom_bottom + 12)
        _draw_text(c, x_col3 + col3_w / 2, bottom_bottom + 4, "FIRMA Y SELLO DEL CLIENTE:", size=5.6, bold=True, align="center")
    else:
        _draw_text(c, x_col3 + 5, bottom_top - 10, "ACEPTACION ELECTRONICA DEL CLIENTE", size=6.3, bold=True)
        _draw_wrapped_text(
            c,
            x_col3 + 5,
            bottom_top - 24,
            "El cliente acepto los terminos y condiciones y confirmo la compra en linea "
            "mediante el pago del pedido, sin necesidad de firma manuscrita.",
            max_width=col3_w - 10,
            size=5.4,
            leading=6,
            max_lines=4,
        )
        _draw_text(c, x_col3 + 5, bottom_bottom + 40, f"CLIENTE: {_safe(invoice.customer_name, '-')}", size=5.8)
        _draw_text(
            c,
            x_col3 + 5,
            bottom_bottom + 24,
            f"PEDIDO: {_safe(order.number, '-')}   FECHA: {invoice.issued_at.strftime('%Y-%m-%d %H:%M')}",
            size=5.8,
        )
        c.line(x_col3, bottom_bottom + 12, x_col3 + col3_w, bottom_bottom + 12)
        _draw_text(c, x_col3 + col3_w / 2, bottom_bottom + 4, "COMPRA CONFIRMADA EN LINEA", size=5.6, bold=True, align="center")

    # Totales
    total_rows = [
        ("SUBTOTAL", _money(goods_base)),
        ("IVA", _money(goods_tax)),
        ("TOTAL", _money(invoice.total)),
        ("TOTAL RETENCIONES", "0"),
        ("A PAGAR", _money(invoice.total)),
    ]

    row_h = bottom_h / len(total_rows)

    for index, (label, value) in enumerate(total_rows):
        row_top = bottom_top - (index * row_h)
        row_bottom = row_top - row_h

        if index:
            c.line(x_col4, row_top, x_col4 + col4_w, row_top)

        if label == "A PAGAR":
            _draw_text(c, x_col4 + 5, row_bottom + 5, label, size=6.3, bold=True)
            _draw_text(c, x_col4 + col4_w - 5, row_bottom + 5, value, size=6.3, bold=True, align="right")
        else:
            _draw_text(c, x_col4 + 5, row_bottom + 5, label, size=6.3, bold=True)
            _draw_text(c, x_col4 + col4_w - 5, row_bottom + 5, value, size=6.3, align="right")

    # ---------------------------------------------------------------------
    # CUFE y textos legales
    # ---------------------------------------------------------------------
    cufe_y = 286
    cufe_h = 14

    cufe_display = (
        invoice.dian_cufe
        if invoice.dian_status == invoice.DianStatus.VALIDATED
        else "PENDIENTE DE VALIDACION DIAN"
    )
    _draw_rect(c, x0, cufe_y, main_w, cufe_h)
    _draw_text(c, x0 + 145, cufe_y + 4, "CUFE:", size=5.5, bold=True)
    _draw_text(
        c,
        x0 + 177,
        cufe_y + 4,
        _fit_text(cufe_display, main_w - 185, font_size=5.2),
        size=5.2,
        bold=True,
    )

    legal_y = 252
    legal_h = 34

    _draw_rect(c, x0, legal_y, main_w, legal_h)
    _draw_wrapped_text(c, x0 + 4, legal_y + 24, LEGAL_NOTICE, max_width=main_w - 8, size=5.6, leading=7, max_lines=2)
    _draw_wrapped_text(c, x0 + 4, legal_y + 12, EXEMPT_GOODS_NOTICE, max_width=main_w - 8, size=5.6, leading=7, max_lines=1)
    _draw_wrapped_text(
        c,
        x0 + 4,
        legal_y + 3,
        "FAVOR CONSIGNAR BANCOLOMBIA CTA CTE Nº 77073761323 RECUADO A NOMBRE PRODUCTOS JUHNIOS ROLD SAS",
        max_width=main_w - 8,
        size=5.6,
        leading=7,
        max_lines=1,
    )

    c.save()
    buffer.seek(0)
    return buffer
