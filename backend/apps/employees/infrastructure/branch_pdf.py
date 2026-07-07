import io
from collections import Counter

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas

from .employee_pdf import (
    BRAND,
    CARD,
    COMPANY_NAME,
    HEADER_BG,
    LINE,
    MUTED,
    _draw_logo,
    _fit,
    _name,
    _pill,
    _safe,
    _status_color,
    _text,
)


def _draw_header(c, page_w, page_h, branches):
    x0, x1 = 32, page_w - 32
    c.setFillColor(BRAND)
    c.rect(x0, page_h - 34, x1 - x0, 3, stroke=0, fill=1)
    logo_size = _draw_logo(c, x0, page_h - 40, 36)
    text_x = x0 + logo_size + (10 if logo_size else 0)
    _text(c, text_x, page_h - 56, COMPANY_NAME, size=12, bold=True)
    _text(c, x1, page_h - 52, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=8, color=MUTED, align="right")
    _text(c, x1, page_h - 66, f"Total sedes: {len(branches)}", size=8, bold=True, color=BRAND, align="right")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(x0, page_h - 80, x1, page_h - 80)
    return page_h - 94


def _draw_summary(c, x, y, width, branches):
    status_counts = Counter(branch.status for branch in branches)
    city_counts = Counter(_safe(branch.city, "Sin ciudad") for branch in branches)
    cards = [
        ("Activas", status_counts.get("ACTIVE", 0)),
        ("Inactivas", status_counts.get("INACTIVE", 0)),
        ("Ciudades", len(city_counts)),
        ("Total sedes", len(branches)),
    ]
    card_w = (width - 24) / 4
    for idx, (label, value) in enumerate(cards):
        cx = x + idx * (card_w + 8)
        c.setFillColor(CARD)
        c.setStrokeColor(LINE)
        c.roundRect(cx, y - 38, card_w, 38, 7, stroke=1, fill=1)
        _text(c, cx + 10, y - 15, label.upper(), size=6.6, bold=True, color=MUTED)
        _text(c, cx + 10, y - 29, value, size=13, bold=True, color=BRAND)
    return y - 50


def _row_values(branch):
    responsible = _name(branch.responsible) if branch.responsible_id else "Sin asignar"
    location = ", ".join(part for part in (_safe(branch.city, ""), _safe(branch.department, "")) if part) or "-"
    return [
        _safe(branch.code),
        _safe(branch.name),
        location,
        _safe(branch.address),
        _safe(branch.phone),
        _safe(branch.email),
        responsible,
        branch.get_status_display(),
    ]


def _draw_table_header(c, x, y, widths):
    labels = ["Codigo", "Sede", "Ciudad/Depto", "Direccion", "Telefono", "Correo", "Responsable", "Estado"]
    c.setFillColor(HEADER_BG)
    c.setStrokeColor(LINE)
    c.roundRect(x, y - 19, sum(widths), 19, 5, stroke=1, fill=1)
    cursor = x
    for label, width in zip(labels, widths):
        _text(c, cursor + 5, y - 12, label.upper(), size=6.2, bold=True, color=BRAND)
        cursor += width


def _draw_branch_row(c, x, y, widths, branch, shaded=False):
    row_h = 22
    if shaded:
        c.setFillColor(HexColor("#fbfcfb"))
        c.rect(x, y - row_h + 3, sum(widths), row_h, stroke=0, fill=1)
    values = _row_values(branch)
    cursor = x
    for idx, (value, width) in enumerate(zip(values, widths)):
        if idx == 7:
            _pill(c, cursor + 5, y - 8, value, _status_color(branch.status), min(56, width - 8))
        else:
            _text(c, cursor + 5, y - 8, _fit(value, width - 9, size=6.8), size=6.8, bold=idx in {0, 1})
        cursor += width
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.line(x, y - row_h + 3, x + sum(widths), y - row_h + 3)
    return y - row_h


def _draw_footer(c, page_w, page_number):
    _text(c, 32, 24, "Documento generado para control interno de Recursos Humanos.", size=6.8, color=MUTED)
    _text(c, page_w - 32, 24, f"Pagina {page_number}", size=6.8, color=MUTED, align="right")


def render_branches_pdf(branches):
    branches = list(branches)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(letter))
    c.setTitle("Reporte general de sedes")

    page_w, page_h = landscape(letter)
    x = 32
    table_w = page_w - 64
    widths = [52, 104, 92, 130, 66, 112, 108, 64]
    page_number = 1

    y = _draw_header(c, page_w, page_h, branches)
    y = _draw_summary(c, x, y, table_w, branches)
    _draw_table_header(c, x, y, widths)
    y -= 24

    if not branches:
        _text(c, x, y - 12, "No hay sedes registradas.", size=9, color=MUTED)
    else:
        for index, branch in enumerate(branches):
            if y < 52 + 24:
                _draw_footer(c, page_w, page_number)
                c.showPage()
                page_number += 1
                y = _draw_header(c, page_w, page_h, branches)
                _draw_table_header(c, x, y, widths)
                y -= 24

            y = _draw_branch_row(c, x, y, widths, branch, shaded=index % 2 == 1)

    _draw_footer(c, page_w, page_number)
    c.save()
    buffer.seek(0)
    return buffer
