import io
import os
from collections import Counter

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
LOGO_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "finance", "infrastructure", "assets", "logo.jpeg")
)
BRAND = HexColor("#2a4038")
TEXT = HexColor("#111827")
MUTED = HexColor("#6b7280")
LINE = HexColor("#e5e7eb")
CARD = HexColor("#f7faf8")
HEADER_BG = HexColor("#eef4f1")
WHITE = HexColor("#ffffff")


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _date(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _fit(text, width, font="Helvetica", size=7):
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


def _status_color(status):
    status = _safe(status, "").upper()
    if status == "ACTIVE":
        return HexColor("#0f7a45")
    if status in {"TERMINATED", "RETIRED"}:
        return HexColor("#b42318")
    if status in {"SUSPENDED", "LEAVE"}:
        return HexColor("#9a6700")
    return HexColor("#4b5563")


def _pill(c, x, y, text, color, width=54):
    c.setFillColor(color)
    c.setStrokeColor(color)
    c.roundRect(x, y - 8, width, 13, 6, stroke=1, fill=1)
    _text(c, x + width / 2, y - 4, _fit(text, width - 8, "Helvetica-Bold", 6.4), size=6.4, bold=True, color=WHITE, align="center")


def _draw_logo(c, x, y, size=36):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        c.drawImage(ImageReader(LOGO_PATH), x, y - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except (OSError, ValueError):
        return 0
    return size


def _draw_header(c, page_w, page_h, employees):
    x0, x1 = 32, page_w - 32
    logo_size = _draw_logo(c, x0, page_h - 40, 36)
    text_x = x0 + logo_size + (10 if logo_size else 0)
    _text(c, text_x, page_h - 56, COMPANY_NAME, size=12, bold=True)
    _text(c, x1, page_h - 52, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=8, color=MUTED, align="right")
    _text(c, x1, page_h - 66, f"Total empleados: {len(employees)}", size=8, bold=True, color=BRAND, align="right")
    return page_h - 94


def _draw_summary(c, x, y, width, employees):
    status_counts = Counter(employee.status for employee in employees)
    department_counts = Counter(_safe(employee.department.name, "Sin area") if employee.department_id else "Sin area" for employee in employees)
    cards = [
        ("Activos", status_counts.get("ACTIVE", 0)),
        ("Inactivos", status_counts.get("INACTIVE", 0)),
        ("Retirados", status_counts.get("TERMINATED", 0)),
        ("Areas", len(department_counts)),
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


def _money(value):
    if value in (None, ""):
        return "-"
    return f"${value:,.0f}"


def _hours(value):
    if value in (None, ""):
        return "-"
    value = float(value)
    text = f"{value:.1f}".rstrip("0").rstrip(".")
    return f"{text} h"


def _row_values(employee):
    department = _safe(employee.department.name, "Sin area") if employee.department_id else "Sin area"
    position = _safe(employee.position.name, "Sin cargo") if employee.position_id else "Sin cargo"
    branch = _safe(employee.branch.name, "Sin sede") if employee.branch_id else "Sin sede"
    document = _safe(employee.document_number, "-")
    return [
        _safe(employee.employee_code),
        _name(employee),
        document,
        department,
        position,
        branch,
        _date(employee.hire_date),
        employee.get_contract_type_display(),
        _money(employee.base_salary),
        _hours(employee.weekly_working_hours),
        employee.get_status_display(),
    ]


def _draw_table_header(c, x, y, widths):
    labels = ["Codigo", "Empleado", "Documento", "Area", "Cargo", "Sede", "Ingreso", "Contrato", "Salario", "Hrs/sem", "Estado"]
    c.setFillColor(HEADER_BG)
    c.setStrokeColor(LINE)
    c.roundRect(x, y - 19, sum(widths), 19, 5, stroke=1, fill=1)
    cursor = x
    for label, width in zip(labels, widths):
        _text(c, cursor + 5, y - 12, label.upper(), size=6.2, bold=True, color=BRAND)
        cursor += width


def _draw_employee_row(c, x, y, widths, employee, shaded=False):
    row_h = 22
    if shaded:
        c.setFillColor(HexColor("#fbfcfb"))
        c.rect(x, y - row_h + 3, sum(widths), row_h, stroke=0, fill=1)
    values = _row_values(employee)
    cursor = x
    for idx, (value, width) in enumerate(zip(values, widths)):
        if idx == 10:
            _pill(c, cursor + 5, y - 8, value, _status_color(employee.status), min(56, width - 8))
        elif idx in {8, 9}:
            _text(c, cursor + width - 6, y - 8, _fit(value, width - 9, size=6.8), size=6.8, align="right")
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


def render_employees_pdf(employees):
    employees = list(employees)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(letter))
    c.setTitle("Reporte general de empleados")

    page_w, page_h = landscape(letter)
    x = 32
    table_w = page_w - 64
    widths = [46, 92, 62, 80, 90, 66, 48, 64, 68, 52, 60]
    page_number = 1

    y = _draw_header(c, page_w, page_h, employees)
    y = _draw_summary(c, x, y, table_w, employees)
    _draw_table_header(c, x, y, widths)
    y -= 24

    if not employees:
        _text(c, x, y - 12, "No hay empleados registrados.", size=9, color=MUTED)
    else:
        last_department = None
        for index, employee in enumerate(employees):
            department = _safe(employee.department.name, "Sin area") if employee.department_id else "Sin area"
            needs_department_label = department != last_department
            required_space = 38 if needs_department_label else 24
            if y < 52 + required_space:
                _draw_footer(c, page_w, page_number)
                c.showPage()
                page_number += 1
                y = _draw_header(c, page_w, page_h, employees)
                _draw_table_header(c, x, y, widths)
                y -= 24
                last_department = None
                needs_department_label = True

            if needs_department_label:
                _text(c, x + 2, y - 4, department.upper(), size=7.2, bold=True, color=BRAND)
                y -= 14
                last_department = department

            y = _draw_employee_row(c, x, y, widths, employee, shaded=index % 2 == 1)

    _draw_footer(c, page_w, page_number)
    c.save()
    buffer.seek(0)
    return buffer
