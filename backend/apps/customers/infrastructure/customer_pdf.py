import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
BRAND = HexColor("#2a4038")
TEXT = HexColor("#111827")
MUTED = HexColor("#6b7280")
LINE = HexColor("#e5e7eb")
CARD = HexColor("#f7faf8")
HEADER_BG = HexColor("#eef4f1")


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _name(customer):
    return f"{_safe(customer.first_name, '')} {_safe(customer.last_name, '')}".strip() or "-"


def _fit(text, width, font="Helvetica", size=7.2):
    from reportlab.pdfbase.pdfmetrics import stringWidth

    text = _safe(text, "")
    if stringWidth(text, font, size) <= width:
        return text
    suffix = "..."
    while text and stringWidth(text + suffix, font, size) > width:
        text = text[:-1]
    return text + suffix if text else suffix


def _text(c, x, y, text, size=8, bold=False, color=TEXT, align="left"):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    text = _safe(text, "")
    if align == "right":
        c.drawRightString(x, y, text)
    elif align == "center":
        c.drawCentredString(x, y, text)
    else:
        c.drawString(x, y, text)


def _draw_header(c, page_w, page_h, count):
    x0, x1 = 32, page_w - 32
    _text(c, x0, page_h - 42, COMPANY_NAME, size=12, bold=True)
    _text(c, x1, page_h - 38, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=8, color=MUTED, align="right")
    _text(c, x1, page_h - 52, f"Total clientes: {count}", size=8, bold=True, color=BRAND, align="right")
    return page_h - 76


def _draw_summary(c, x, y, width, customers):
    total_orders = sum(customer.orders_count for customer in customers)
    cities = {_safe(customer.city, "Sin ciudad") for customer in customers}
    cards = [
        ("Total clientes", len(customers)),
        ("Total pedidos", total_orders),
        ("Ciudades", len(cities)),
    ]
    card_w = (width - 16) / 3
    for idx, (label, value) in enumerate(cards):
        cx = x + idx * (card_w + 8)
        c.setFillColor(CARD)
        c.setStrokeColor(LINE)
        c.roundRect(cx, y - 38, card_w, 38, 7, stroke=1, fill=1)
        _text(c, cx + 10, y - 15, label.upper(), size=6.6, bold=True, color=MUTED)
        _text(c, cx + 10, y - 29, value, size=13, bold=True, color=BRAND)
    return y - 50


def _row_values(customer):
    address = ", ".join(part for part in (_safe(customer.address, ""), _safe(customer.city, "")) if part) or "-"
    return [
        _name(customer),
        address,
        _safe(customer.phone),
        _safe(customer.email),
        str(customer.orders_count),
    ]


def _draw_table_header(c, x, y, widths):
    labels = ["Nombre", "Direccion", "Telefono", "Correo", "Pedidos"]
    c.setFillColor(HEADER_BG)
    c.setStrokeColor(LINE)
    c.roundRect(x, y - 19, sum(widths), 19, 5, stroke=1, fill=1)
    cursor = x
    for label, width in zip(labels, widths):
        _text(c, cursor + 5, y - 12, label.upper(), size=6.6, bold=True, color=BRAND)
        cursor += width


def _draw_customer_row(c, x, y, widths, customer, shaded=False):
    row_h = 22
    if shaded:
        c.setFillColor(HexColor("#fbfcfb"))
        c.rect(x, y - row_h + 3, sum(widths), row_h, stroke=0, fill=1)
    values = _row_values(customer)
    cursor = x
    for idx, (value, width) in enumerate(zip(values, widths)):
        align = "right" if idx == 4 else "left"
        pad = width - 9 if align == "left" else width - 6
        if align == "right":
            _text(c, cursor + width - 6, y - 8, _fit(value, pad), size=7.2, align="right")
        else:
            _text(c, cursor + 5, y - 8, _fit(value, pad), size=7.2, bold=idx == 0)
        cursor += width
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.line(x, y - row_h + 3, x + sum(widths), y - row_h + 3)
    return y - row_h


def _draw_footer(c, page_w, page_number):
    _text(c, 32, 24, "Documento generado para control interno de clientes.", size=6.8, color=MUTED)
    _text(c, page_w - 32, 24, f"Pagina {page_number}", size=6.8, color=MUTED, align="right")


def render_customers_pdf(customers):
    customers = list(customers)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(letter))
    c.setTitle("Reporte general de clientes")

    page_w, page_h = landscape(letter)
    x = 32
    table_w = page_w - 64
    widths = [150, 260, 90, 160, 68]
    page_number = 1

    y = _draw_header(c, page_w, page_h, len(customers))
    y = _draw_summary(c, x, y, table_w, customers)
    _draw_table_header(c, x, y, widths)
    y -= 24

    if not customers:
        _text(c, x, y - 12, "No hay clientes registrados.", size=9, color=MUTED)
    else:
        for index, customer in enumerate(customers):
            if y < 52 + 24:
                _draw_footer(c, page_w, page_number)
                c.showPage()
                page_number += 1
                y = _draw_header(c, page_w, page_h, len(customers))
                _draw_table_header(c, x, y, widths)
                y -= 24

            y = _draw_customer_row(c, x, y, widths, customer, shaded=index % 2 == 1)

    _draw_footer(c, page_w, page_number)
    c.save()
    buffer.seek(0)
    return buffer
