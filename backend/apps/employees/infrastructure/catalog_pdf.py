import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
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
    _safe,
    _text,
)


def _draw_header(c, page_w, page_h, count, total_label):
    x0, x1 = 32, page_w - 32
    logo_size = _draw_logo(c, x0, page_h - 40, 36)
    text_x = x0 + logo_size + (10 if logo_size else 0)
    _text(c, text_x, page_h - 56, COMPANY_NAME, size=12, bold=True)
    _text(c, x1, page_h - 52, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=8, color=MUTED, align="right")
    _text(c, x1, page_h - 66, f"{total_label}: {count}", size=8, bold=True, color=BRAND, align="right")
    return page_h - 94


def _draw_table_header(c, x, y, widths, labels):
    c.setFillColor(HEADER_BG)
    c.setStrokeColor(LINE)
    c.roundRect(x, y - 19, sum(widths), 19, 5, stroke=1, fill=1)
    cursor = x
    for label, width in zip(labels, widths):
        _text(c, cursor + 5, y - 12, label.upper(), size=6.6, bold=True, color=BRAND)
        cursor += width


def _draw_row(c, x, y, widths, values, shaded=False):
    row_h = 22
    if shaded:
        c.setFillColor(HexColor("#fbfcfb"))
        c.rect(x, y - row_h + 3, sum(widths), row_h, stroke=0, fill=1)
    cursor = x
    for idx, (value, width) in enumerate(zip(values, widths)):
        _text(c, cursor + 5, y - 8, _fit(value, width - 9, size=7.2), size=7.2, bold=idx == 0)
        cursor += width
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.line(x, y - row_h + 3, x + sum(widths), y - row_h + 3)
    return y - row_h


def _draw_footer(c, page_w, page_number, footer_text):
    _text(c, 32, 24, footer_text, size=6.8, color=MUTED)
    _text(c, page_w - 32, 24, f"Pagina {page_number}", size=6.8, color=MUTED, align="right")


def render_departments_pdf(departments):
    departments = list(departments)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle("Reporte general de departamentos")

    page_w, page_h = letter
    x = 32
    widths = [180, 300, 68]
    footer_text = "Documento generado para control interno de Recursos Humanos."

    y = _draw_header(c, page_w, page_h, len(departments), "Total departamentos")
    _draw_table_header(c, x, y, widths, ["Departamento", "Descripcion", "Estado"])
    y -= 24
    page_number = 1

    if not departments:
        _text(c, x, y - 12, "No hay departamentos registrados.", size=9, color=MUTED)
    else:
        for index, department in enumerate(departments):
            if y < 52 + 24:
                _draw_footer(c, page_w, page_number, footer_text)
                c.showPage()
                page_number += 1
                y = _draw_header(c, page_w, page_h, len(departments), "Total departamentos")
                _draw_table_header(c, x, y, widths, ["Departamento", "Descripcion", "Estado"])
                y -= 24

            values = [
                _safe(department.name),
                _safe(department.description),
                "Activo" if department.is_active else "Inactivo",
            ]
            y = _draw_row(c, x, y, widths, values, shaded=index % 2 == 1)

    _draw_footer(c, page_w, page_number, footer_text)
    c.save()
    buffer.seek(0)
    return buffer


def render_positions_pdf(positions):
    positions = list(positions)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle("Reporte general de cargos")

    page_w, page_h = letter
    x = 32
    widths = [170, 150, 160, 68]
    footer_text = "Documento generado para control interno de Recursos Humanos."

    y = _draw_header(c, page_w, page_h, len(positions), "Total cargos")
    _draw_table_header(c, x, y, widths, ["Cargo", "Departamento", "Descripcion", "Estado"])
    y -= 24
    page_number = 1

    if not positions:
        _text(c, x, y - 12, "No hay cargos registrados.", size=9, color=MUTED)
    else:
        for index, position in enumerate(positions):
            if y < 52 + 24:
                _draw_footer(c, page_w, page_number, footer_text)
                c.showPage()
                page_number += 1
                y = _draw_header(c, page_w, page_h, len(positions), "Total cargos")
                _draw_table_header(c, x, y, widths, ["Cargo", "Departamento", "Descripcion", "Estado"])
                y -= 24

            values = [
                _safe(position.name),
                _safe(position.department.name) if position.department_id else "-",
                _safe(position.description),
                "Activo" if position.is_active else "Inactivo",
            ]
            y = _draw_row(c, x, y, widths, values, shaded=index % 2 == 1)

    _draw_footer(c, page_w, page_number, footer_text)
    c.save()
    buffer.seek(0)
    return buffer
