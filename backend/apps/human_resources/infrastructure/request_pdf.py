import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
BRAND_COLOR = HexColor("#2a4038")
BRAND_COLOR_DARK = HexColor("#1f302a")
TEXT_COLOR = HexColor("#111827")
MUTED_COLOR = HexColor("#6b7280")
LINE_COLOR = HexColor("#e5e7eb")
CARD_BG = HexColor("#f8faf9")
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
    _round_rect(c, x0, y - 62, main_w, 64, fill_color=BRAND_COLOR_DARK, stroke_color=BRAND_COLOR_DARK, radius=10)
    _draw_text(c, x0 + 18, y - 18, COMPANY_NAME, size=13, bold=True, color=WHITE)
    _draw_text(c, x0 + 18, y - 35, "Recursos Humanos", size=8.5, color=HexColor("#d9e4df"))
    _draw_text(c, x1 - 18, y - 18, "Documento de solicitud", size=12, bold=True, align="right", color=WHITE)
    _draw_text(c, x1 - 18, y - 35, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=8.5, align="right", color=HexColor("#d9e4df"))
    status_text = vacation.get_status_display()
    pill_w = max(84, stringWidth(status_text, "Helvetica-Bold", 7.3) + 18)
    _pill(c, x1 - 18 - pill_w, y - 50, status_text, _status_color(vacation.status), pill_w)


def _draw_summary_card(c, x0, y, w, vacation, employee):
    h = 58
    _round_rect(c, x0, y - h, w, h, fill_color=CARD_BG, stroke_color=LINE_COLOR, radius=8)
    _field(c, x0 + 14, y - 18, "Solicitud", vacation.request_number or str(vacation.id), 115)
    _field(c, x0 + 142, y - 18, "Tipo", _request_type_label(vacation), 125)
    _field(c, x0 + 278, y - 18, "Periodo", f"{_date_label(vacation.start_date)} - {_date_label(vacation.end_date)}", 130)
    _field(c, x0 + 420, y - 18, "Solicitante", _employee_name(employee), 120)
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
    max_lines = min(max(len(lines), 2), 5)
    h = 34 + max_lines * 12
    _round_rect(c, x, y - h, w, h, fill_color=WHITE, stroke_color=LINE_COLOR, radius=8)
    _section_label(c, x + 14, y - 16, "Motivo / descripcion")
    _draw_wrapped_text(c, x + 14, y - 36, reason, w - 28, size=9, max_lines=5)
    return y - h


def _draw_step(c, x, y, w, step_name, status, actor, date_text, comment):
    h = 34
    _round_rect(c, x, y - h, w, h, fill_color=CARD_BG, stroke_color=LINE_COLOR, radius=7)
    c.setFillColor(_status_color(status))
    c.circle(x + 13, y - 17, 4, stroke=0, fill=1)
    _draw_text(c, x + 26, y - 13, step_name, size=8.6, bold=True)
    _draw_text(c, x + 26, y - 25, _fit_text(actor, 130, font_size=7.5), size=7.5, color=MUTED_COLOR)
    status_label = _fit_text(status if status else "Pendiente", 78, "Helvetica-Bold", 7.3)
    _pill(c, x + w - 156, y - 12, status_label, _status_color(status_label), 82)
    _draw_text(c, x + w - 64, y - 14, date_text, size=7.4, color=MUTED_COLOR)
    if comment and comment != "-":
        _draw_text(c, x + w - 220, y - 26, _fit_text(comment, 150, font_size=7.4), size=7.4, color=MUTED_COLOR)


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

    h = 30 + max(len(steps), 1) * 42
    _round_rect(c, x, y - h, w, h, fill_color=WHITE, stroke_color=LINE_COLOR, radius=8)
    _section_label(c, x + 14, y - 16, "Flujo de aprobacion")
    current_y = y - 36

    if not steps:
        _draw_text(c, x + 14, current_y, "Sin pasos de aprobacion registrados.", size=8.5, color=MUTED_COLOR)
        return y - h

    for item in steps[:6]:
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
        _draw_step(c, x + 14, current_y, w - 28, step_name, status, actor, date_text, _safe(comment))
        current_y -= 42

    if len(steps) > 6:
        _draw_text(c, x + 14, current_y + 5, f"+ {len(steps) - 6} paso(s) adicional(es)", size=8, bold=True, color=MUTED_COLOR)
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
