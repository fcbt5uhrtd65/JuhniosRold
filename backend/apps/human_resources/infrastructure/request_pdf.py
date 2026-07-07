import io
import os

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
LOGO_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "finance", "infrastructure", "assets", "logo.jpeg")
)
BRAND_COLOR = HexColor("#2a4038")
TEXT_COLOR = HexColor("#111827")
MUTED_COLOR = HexColor("#6b7280")
LINE_COLOR = HexColor("#e5e7eb")
CARD_BG = HexColor("#f7faf8")
SUBTLE_BG = HexColor("#fbfcfb")
WHITE = HexColor("#ffffff")
SUCCESS = HexColor("#0f7a45")
WARNING = HexColor("#9a6700")
DANGER = HexColor("#b42318")
NEUTRAL = HexColor("#4b5563")


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _font(bold=False):
    return "Helvetica-Bold" if bold else "Helvetica"


def _draw_text(c, x, y, text, size=9, bold=False, align="left", color=TEXT_COLOR):
    c.setFillColor(color)
    c.setFont(_font(bold), size)
    text = _safe(text, "")
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def _fit_text(text, max_width, font_name="Helvetica", font_size=9):
    text = _safe(text, "")
    if stringWidth(text, font_name, font_size) <= max_width:
        return text
    suffix = "..."
    while text and stringWidth(text + suffix, font_name, font_size) > max_width:
        text = text[:-1]
    return text + suffix if text else suffix


def _wrap_lines(text, max_width, font_name="Helvetica", font_size=9):
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
    return lines or [""]


def _draw_wrapped_text(c, x, y, text, max_width, size=9, bold=False, leading=None, max_lines=None, color=TEXT_COLOR):
    font_name = _font(bold)
    leading = leading or size + 3
    lines = _wrap_lines(text, max_width, font_name, size)
    truncated = bool(max_lines) and len(lines) > max_lines
    if max_lines:
        lines = lines[:max_lines]
    if truncated and lines:
        lines[-1] = _fit_text(f"{lines[-1]} ...", max_width, font_name, size)
    c.setFillColor(color)
    c.setFont(font_name, size)
    for idx, line in enumerate(lines):
        c.drawString(x, y - (idx * leading), line)
    return y - (len(lines) * leading)


def _round_rect(c, x, y, w, h, fill_color=WHITE, stroke_color=LINE_COLOR, radius=8):
    c.setFillColor(fill_color)
    c.setStrokeColor(stroke_color)
    c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def _section_label(c, x, y, title):
    _draw_text(c, x, y, title.upper(), size=8.5, bold=True, color=BRAND_COLOR)


def _field(c, x, y, label, value, max_width):
    _draw_text(c, x, y, label.upper(), size=6.8, bold=True, color=MUTED_COLOR)
    _draw_text(c, x, y - 12, _fit_text(value, max_width, font_size=9), size=9, color=TEXT_COLOR)


def _status_color(status):
    status = _safe(status, "").upper()
    if "APROB" in status:
        return SUCCESS
    if "RECHAZ" in status or "CANCEL" in status:
        return DANGER
    if "PEND" in status or "REVISION" in status or "REVIS" in status:
        return WARNING
    if status in {"APPROVED", "FINALIZED"}:
        return SUCCESS
    if status in {"REJECTED", "CANCELLED"}:
        return DANGER
    if status in {"PENDING", "IN_REVIEW", "PENDING_HR", "PENDING_ADMIN"}:
        return WARNING
    return NEUTRAL


def _pill(c, x, y, text, color, w=None):
    text = _safe(text, "-")
    w = w or max(58, stringWidth(text, "Helvetica-Bold", 7.3) + 16)
    c.setFillColor(color)
    c.setStrokeColor(color)
    c.roundRect(x, y - 9, w, 14, 7, stroke=1, fill=1)
    _draw_text(c, x + w / 2, y - 5, text, size=7.3, bold=True, align="center", color=WHITE)
    return w


def _draw_logo(c, x, y, size=44):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        logo = ImageReader(LOGO_PATH)
        c.drawImage(logo, x, y - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except (OSError, ValueError):
        return 0
    return size


def _request_type_label(vacation):
    return _safe(vacation.get_request_type_display())


def _date_label(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _datetime_label(value):
    return f"{value:%d/%m/%Y %H:%M}" if value else "-"


def _employee_name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or "-"


def _draw_header(c, x0, x1, y, vacation):
    main_w = x1 - x0
    c.setFillColor(BRAND_COLOR)
    c.rect(x0, y - 5, main_w, 3, stroke=0, fill=1)
    logo_size = _draw_logo(c, x0, y - 13, size=42)
    text_x = x0 + logo_size + (12 if logo_size else 0)
    _draw_text(c, text_x, y - 22, COMPANY_NAME, size=13.5, bold=True)
    _draw_text(c, text_x, y - 38, "Recursos Humanos", size=8.5, color=MUTED_COLOR)
    _draw_text(c, x1, y - 22, "Documento de solicitud", size=12, bold=True, align="right", color=BRAND_COLOR)
    _draw_text(c, x1, y - 38, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=8.5, align="right", color=MUTED_COLOR)
    status_text = vacation.get_status_display()
    pill_w = max(84, stringWidth(status_text, "Helvetica-Bold", 7.3) + 18)
    _pill(c, x1 - pill_w, y - 53, status_text, _status_color(vacation.status), pill_w)
    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(0.8)
    c.line(x0, y - 65, x1, y - 65)


def _draw_summary_card(c, x0, y, w, vacation, employee):
    h = 54
    _round_rect(c, x0, y - h, w, h, fill_color=CARD_BG, stroke_color=LINE_COLOR, radius=8)
    _field(c, x0 + 14, y - 17, "Solicitud", vacation.request_number or str(vacation.id), 115)
    _field(c, x0 + 142, y - 17, "Tipo", _request_type_label(vacation), 125)
    _field(c, x0 + 278, y - 17, "Periodo", f"{_date_label(vacation.start_date)} - {_date_label(vacation.end_date)}", 130)
    _field(c, x0 + 420, y - 17, "Solicitante", _employee_name(employee), 120)
    return y - h


def _draw_info_card(c, x, y, w, title, fields):
    row_h = 31
    rows = (len(fields) + 1) // 2
    h = 28 + rows * row_h
    _round_rect(c, x, y - h, w, h, fill_color=WHITE, stroke_color=LINE_COLOR, radius=8)
    _section_label(c, x + 14, y - 16, title)
    col_w = (w - 34) / 2
    for idx, (label, value) in enumerate(fields):
        col = idx % 2
        row = idx // 2
        fx = x + 14 + col * (col_w + 12)
        fy = y - 39 - row * row_h
        _field(c, fx, fy, label, value, col_w)
    return y - h


def _draw_reason_card(c, x, y, w, reason):
    lines = _wrap_lines(reason, w - 28, "Helvetica", 9)
    max_lines = min(max(len(lines), 2), 3)
    h = 34 + max_lines * 12
    _round_rect(c, x, y - h, w, h, fill_color=WHITE, stroke_color=LINE_COLOR, radius=8)
    _section_label(c, x + 14, y - 16, "Motivo / descripcion")
    _draw_wrapped_text(c, x + 14, y - 36, reason, w - 28, size=9, max_lines=3)
    return y - h


def _draw_step(c, x, y, w, number, step_name, status, actor, date_text, comment):
    h = 43
    fill = CARD_BG if number % 2 else SUBTLE_BG
    _round_rect(c, x, y - h, w, h, fill_color=fill, stroke_color=LINE_COLOR, radius=7)
    status_label = _safe(status, "Pendiente")
    status_color = _status_color(status_label)
    c.setFillColor(WHITE)
    c.setStrokeColor(status_color)
    c.setLineWidth(1.1)
    c.circle(x + 14, y - 20, 8, stroke=1, fill=1)
    _draw_text(c, x + 14, y - 23, str(number), size=7, bold=True, align="center", color=status_color)
    _draw_text(c, x + 30, y - 13, _fit_text(step_name, 148, font_size=8.5), size=8.5, bold=True)
    _pill(c, x + 190, y - 12, _fit_text(status_label, 72, "Helvetica-Bold", 7.2), status_color, 82)
    _draw_text(c, x + 290, y - 13, _fit_text(f"Fecha: {date_text}", 120, font_size=7.4), size=7.4, color=TEXT_COLOR)
    detail = comment if comment and comment != "-" else "Pendiente de gestion" if date_text == "-" else "Accion registrada"
    _draw_text(c, x + 30, y - 28, _fit_text(f"Responsable: {actor}", 218, font_size=7.4), size=7.4, color=MUTED_COLOR)
    _draw_text(c, x + 260, y - 28, _fit_text(f"Detalle: {detail}", w - 266, font_size=7.4), size=7.4, color=MUTED_COLOR)


def _draw_approval_flow(c, x, y, w, vacation):
    steps = list(vacation.approval_steps.all())
    if not steps:
        decisions = [
            ("Administrador", vacation.admin_decision, vacation.admin_decided_by, vacation.admin_decided_at, vacation.admin_comment),
            ("Recursos Humanos", vacation.hr_decision, vacation.hr_decided_by, vacation.hr_decided_at, vacation.hr_comment),
        ]
        steps = []
        for role_label, decision, decided_by, decided_at, comment in decisions:
            decision_label = dict(vacation.Status.choices).get(decision, "Pendiente") if decision else "Pendiente"
            steps.append((role_label, decision_label, decided_by, decided_at, comment))

    visible_steps = steps[:4]
    h = 35 + max(len(visible_steps), 1) * 47
    _round_rect(c, x, y - h, w, h, fill_color=WHITE, stroke_color=LINE_COLOR, radius=8)
    _section_label(c, x + 14, y - 16, "Flujo de aprobacion")
    _draw_text(c, x + w - 14, y - 16, "Estado, responsable, fecha y detalle", size=7.4, align="right", color=MUTED_COLOR)
    current_y = y - 38

    if not steps:
        _draw_text(c, x + 14, current_y, "Sin pasos de aprobacion registrados.", size=8.5, color=MUTED_COLOR)
        return y - h

    for number, item in enumerate(visible_steps, start=1):
        if isinstance(item, tuple):
            step_name, status, user, acted_at, comment = item
            actor = _safe(getattr(user, "email", None), "-")
            date_text = _datetime_label(acted_at)
        else:
            step_name = item.get_step_display()
            status = item.get_status_display()
            actor = _safe(getattr(item.user, "email", None), "-")
            date_text = _datetime_label(item.acted_at)
            comment = item.comment
        _draw_step(c, x + 14, current_y, w - 28, number, step_name, status, actor, date_text, _safe(comment))
        current_y -= 47

    if len(steps) > 4:
        _draw_text(c, x + 14, current_y + 6, f"+ {len(steps) - 4} paso(s) adicional(es) no mostrados para conservar una hoja.", size=8, bold=True, color=MUTED_COLOR)
    return y - h


def render_request_pdf(vacation):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Solicitud {vacation.request_number or vacation.id}")

    page_w, page_h = letter
    x0, x1 = 40, page_w - 40
    main_w = x1 - x0
    y = page_h - 36

    employee = vacation.employee

    _draw_header(c, x0, x1, y, vacation)
    y -= 82
    y = _draw_summary_card(c, x0, y, main_w, vacation, employee)
    y -= 14

    applicant_fields = [
        ("Nombre", _employee_name(employee)),
        ("Codigo", getattr(employee, "employee_code", "") or "-"),
        ("Cargo", employee.position.name if employee.position_id else "-"),
        ("Departamento", employee.department.name if employee.department_id else "-"),
        ("Sede", employee.branch.name if employee.branch_id else "-"),
    ]
    request_fields = [
        ("Fecha de creacion", _datetime_label(vacation.created_at)),
        ("Subtipo", vacation.get_subtype_display() if vacation.subtype else "-"),
        ("Desde", _date_label(vacation.start_date)),
        ("Hasta", _date_label(vacation.end_date)),
        ("Estado actual", vacation.get_status_display()),
    ]

    left_w = (main_w - 12) / 2
    left_bottom = _draw_info_card(c, x0, y, left_w, "Datos del solicitante", applicant_fields)
    right_bottom = _draw_info_card(c, x0 + left_w + 12, y, left_w, "Datos de la solicitud", request_fields)
    y = min(left_bottom, right_bottom) - 14

    y = _draw_reason_card(c, x0, y, main_w, vacation.reason or vacation.description or "Sin descripcion.")
    y -= 14
    y = _draw_approval_flow(c, x0, y, main_w, vacation)

    c.setFillColor(MUTED_COLOR)
    c.setFont("Helvetica", 7)
    c.drawCentredString(page_w / 2, 30, "Documento generado automaticamente para control interno de Recursos Humanos.")

    c.save()
    buffer.seek(0)
    return buffer
