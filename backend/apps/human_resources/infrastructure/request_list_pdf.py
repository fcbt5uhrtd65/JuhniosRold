import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from shared.infrastructure.pdf_letterhead import draw_letterhead_footer, draw_letterhead_header

from .models import VacationRequest

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"

TEXT = HexColor("#1a1a1a")
MUTED = HexColor("#5d6d7e")
LINE = HexColor("#e3e8ee")
ROW_ALT = HexColor("#f6f8fa")
SUCCESS = HexColor("#1f8a4c")
WARNING = HexColor("#b7791f")
DANGER = HexColor("#b3261e")
NEUTRAL = HexColor("#5d6d7e")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _employee_name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _date_label(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _status_color(status):
    status = _safe(status, "").upper()
    if status in {"APPROVED", "FINALIZED"}:
        return SUCCESS
    if status in {"REJECTED", "CANCELLED", "EXPIRED"}:
        return DANGER
    if status in {"PENDING", "IN_REVIEW", "PENDING_HR", "PENDING_ADMIN"}:
        return WARNING
    return NEUTRAL


def _text(c, x, y, text, size=9, bold=False, align="left", color=TEXT):
    c.setFillColor(color)
    c.setFont(FONT_BOLD if bold else FONT, size)
    text = _safe(text, "")
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def _fit_text(text, max_width, font_name=FONT, font_size=8):
    text = _safe(text, "")
    if stringWidth(text, font_name, font_size) <= max_width:
        return text
    suffix = "…"
    while text and stringWidth(text + suffix, font_name, font_size) > max_width:
        text = text[:-1]
    return text + suffix if text else suffix


def _draw_filters_summary(c, x0, x1, y, filters_applied):
    if not filters_applied:
        _text(c, x0, y, "Filtros aplicados: ninguno (se incluyen todas las solicitudes).", size=8.5, color=MUTED)
        return y - 16
    parts = "  ·  ".join(f"{label}: {value}" for label, value in filters_applied)
    _text(c, x0, y, "Filtros aplicados:", size=8.5, bold=True, color=MUTED)
    _text(c, x0 + 76, y, _fit_text(parts, (x1 - x0) - 76, FONT, 8.5), size=8.5, color=MUTED)
    return y - 16


def _draw_summary_counts(c, x0, x1, y, requests):
    """Resumen de cuántas solicitudes hay por tipo, para ver de un vistazo cuántas
    personas han pedido horas extra, permisos, vacaciones, licencias, etc."""
    counts = {choice_value: 0 for choice_value, _ in VacationRequest.RequestType.choices}
    for item in requests:
        counts[item.request_type] = counts.get(item.request_type, 0) + 1

    labels = dict(VacationRequest.RequestType.choices)
    entries = [(labels[key], counts[key]) for key in counts]

    _text(c, x0, y, "Resumen por tipo de solicitud", size=11, bold=True, color=TEXT)
    y -= 20

    col_w = (x1 - x0) / len(entries)
    for index, (label, count) in enumerate(entries):
        cx = x0 + index * col_w + col_w / 2
        _text(c, cx, y, str(count), size=18, bold=True, color=TEXT, align="center")
        _text(c, cx, y - 14, label.upper(), size=7.3, color=MUTED, align="center")

    return y - 34


COLUMNS = (
    ("employee", "Empleado", 0.20),
    ("type", "Tipo", 0.11),
    ("period", "Periodo", 0.16),
    ("qty", "Cant.", 0.08),
    ("status", "Estado", 0.11),
    ("decided_by", "Resuelto por", 0.16),
    ("decided_at", "Fecha decisión", 0.18),
)


def _quantity_label(item):
    if item.request_type == VacationRequest.RequestType.OVERTIME and item.hours_count:
        return f"{item.hours_count} h"
    if item.days_count:
        return f"{item.days_count} d"
    return "-"


def _decided_by_label(item):
    decider = item.hr_decided_by or item.admin_decided_by or item.reviewed_by
    if not decider:
        return "-"
    employee = getattr(decider, "employee_profile", None)
    return _employee_name(employee) if employee else _safe(getattr(decider, "email", None))


def _decided_at_label(item):
    decided_at = item.hr_decided_at or item.admin_decided_at or item.reviewed_at
    return f"{decided_at:%d/%m/%Y %H:%M}" if decided_at else "-"


def _draw_table_header(c, x0, x1, y):
    widths = {key: (x1 - x0) * frac for key, _, frac in COLUMNS}
    c.setFillColor(TEXT)
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.line(x0, y + 4, x1, y + 4)
    cursor = x0
    for key, label, _ in COLUMNS:
        _text(c, cursor, y - 9, label.upper(), size=7.6, bold=True, color=MUTED)
        cursor += widths[key]
    return y - 18, widths


def _draw_table_row(c, x0, y, widths, index, item):
    row_h = 22
    if index % 2:
        c.setFillColor(ROW_ALT)
        c.rect(x0, y - row_h + 6, sum(widths.values()), row_h - 4, stroke=0, fill=1)

    cursor = x0
    employee = item.employee
    _text(c, cursor + 2, y - 6, _fit_text(_employee_name(employee), widths["employee"] - 6, FONT_BOLD, 8), size=8, bold=True)
    _text(c, cursor + 2, y - 16, _fit_text(employee.department.name if employee.department_id else "-", widths["employee"] - 6, FONT, 7), size=7, color=MUTED)
    cursor += widths["employee"]

    _text(c, cursor + 2, y - 11, _fit_text(item.get_request_type_display(), widths["type"] - 4, FONT, 7.6), size=7.6)
    cursor += widths["type"]

    period = f"{_date_label(item.start_date)} - {_date_label(item.end_date)}"
    _text(c, cursor + 2, y - 11, _fit_text(period, widths["period"] - 4, FONT, 7.6), size=7.6)
    cursor += widths["period"]

    _text(c, cursor + 2, y - 11, _quantity_label(item), size=7.6)
    cursor += widths["qty"]

    status_color = _status_color(item.status)
    _text(c, cursor + 2, y - 11, _fit_text(item.get_status_display(), widths["status"] - 4, FONT_BOLD, 7.6), size=7.6, bold=True, color=status_color)
    cursor += widths["status"]

    _text(c, cursor + 2, y - 11, _fit_text(_decided_by_label(item), widths["decided_by"] - 4, FONT, 7.6), size=7.6, color=MUTED)
    cursor += widths["decided_by"]

    _text(c, cursor + 2, y - 11, _decided_at_label(item), size=7.4, color=MUTED)

    return y - row_h


def render_request_list_pdf(requests, filters_applied=None):
    """Listado organizado de solicitudes de RRHH (vacaciones, permisos, horas extra,
    licencias, incapacidades) con resumen de conteos por tipo y trazabilidad de quién
    resolvió cada una y cuándo. ``requests`` debe venir ya filtrado/ordenado."""
    requests = list(requests)
    filters_applied = filters_applied or []

    buffer = io.BytesIO()
    page_w, page_h = landscape(letter)
    c = canvas.Canvas(buffer, pagesize=(page_w, page_h))
    c.setTitle("Listado de solicitudes de RRHH")

    x0, x1 = 48, page_w - 48
    footer_h = draw_letterhead_footer(c, page_w, x0, x1)
    bottom_limit = footer_h + 26

    def draw_page_header():
        y = draw_letterhead_header(c, page_w, page_h, x0, x1)
        _text(c, x0, y, f"Gestión de Talento Humano  ·  {len(requests)} solicitud(es)", size=8.5, bold=True, color=MUTED)
        _text(c, x1, y, f"Generado el {timezone.now():%d/%m/%Y a las %H:%M}", size=8, color=MUTED, align="right")
        y -= 34
        _text(c, x0, y, "LISTADO DE SOLICITUDES", size=16, bold=True, color=TEXT)
        return y - 30

    y = draw_page_header()
    y = _draw_filters_summary(c, x0, x1, y, filters_applied)
    y -= 6
    y = _draw_summary_counts(c, x0, x1, y, requests)
    y -= 10

    if not requests:
        _text(c, x0, y, "No hay solicitudes que coincidan con los filtros aplicados.", size=9.5, color=MUTED)
        c.setFillColor(MUTED)
        c.setFont(FONT, 7.2)
        c.drawCentredString(page_w / 2, bottom_limit - 12, f"Documento oficial · {COMPANY_NAME} · Trazabilidad de solicitudes de RRHH.")
        c.save()
        buffer.seek(0)
        return buffer

    y, widths = _draw_table_header(c, x0, x1, y)

    for index, item in enumerate(requests):
        if y - 22 < bottom_limit:
            c.setFillColor(MUTED)
            c.setFont(FONT, 7.2)
            c.drawCentredString(page_w / 2, bottom_limit - 12, f"Documento oficial · {COMPANY_NAME} · Trazabilidad de solicitudes de RRHH.")
            c.showPage()
            footer_h = draw_letterhead_footer(c, page_w, x0, x1)
            bottom_limit = footer_h + 26
            y = draw_page_header()
            y, widths = _draw_table_header(c, x0, x1, y)
        y = _draw_table_row(c, x0, y, widths, index, item)

    c.setFillColor(MUTED)
    c.setFont(FONT, 7.2)
    c.drawCentredString(page_w / 2, bottom_limit - 12, f"Documento oficial · {COMPANY_NAME} · Trazabilidad de solicitudes de RRHH.")

    c.save()
    buffer.seek(0)
    return buffer
