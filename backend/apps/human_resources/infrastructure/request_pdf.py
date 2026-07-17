import io
import os
from datetime import datetime

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from shared.infrastructure.signature_pdf import draw_signature_block, resolve_signature_file, signature_block_height

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
LOGO_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "finance", "infrastructure", "assets", "logo.jpeg")
)
PRIMARY = HexColor("#1b3a4b")
ACCENT = HexColor("#2e6da4")
TEXT = HexColor("#1f2937")
MUTED = HexColor("#5d6d7e")
LINE = HexColor("#c7d2d9")
SUCCESS = HexColor("#1f8a4c")
WARNING = HexColor("#b7791f")
DANGER = HexColor("#b3261e")
NEUTRAL = HexColor("#5d6d7e")
WHITE = HexColor("#ffffff")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


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


def _fit_text(text, max_width, font_name=FONT, font_size=9):
    text = _safe(text, "")
    if stringWidth(text, font_name, font_size) <= max_width:
        return text
    suffix = "..."
    while text and stringWidth(text + suffix, font_name, font_size) > max_width:
        text = text[:-1]
    return text + suffix if text else suffix


def _wrap_lines(text, max_width, font_name=FONT, font_size=9):
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


def _draw_wrapped_text(c, x, y, text, max_width, size=9, bold=False, leading=None, max_lines=None, color=TEXT):
    font_name = FONT_BOLD if bold else FONT
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


def _status_color(status):
    status = _safe(status, "").upper()
    if "APROB" in status or status in {"APPROVED", "FINALIZED"}:
        return SUCCESS
    if "RECHAZ" in status or "CANCEL" in status or status in {"REJECTED", "CANCELLED"}:
        return DANGER
    if "PEND" in status or "REVIS" in status or status in {"PENDING", "IN_REVIEW", "PENDING_HR", "PENDING_ADMIN"}:
        return WARNING
    return NEUTRAL


def _draw_logo(c, x, y, size=38):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        c.drawImage(ImageReader(LOGO_PATH), x, y - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except (OSError, ValueError):
        return 0
    return size


def _request_type_label(vacation):
    return _safe(vacation.get_request_type_display())


def _date_label(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _datetime_label(value):
    return f"{value:%d/%m/%Y %H:%M}" if value else "-"


def _time_label(value):
    return f"{value:%H:%M}" if value else "-"


def _calculate_hours_label(vacation):
    if vacation.start_time and vacation.end_time:
        base_date = vacation.start_date or vacation.end_date
        start = datetime.combine(base_date, vacation.start_time)
        end = datetime.combine(base_date, vacation.end_time)
        if end > start:
            day_count = 1
            if vacation.start_date and vacation.end_date:
                day_count = max((vacation.end_date - vacation.start_date).days + 1, 1)
            minutes = int((end - start).total_seconds() // 60) * day_count
            hours, remainder = divmod(minutes, 60)
            if remainder:
                return f"{hours} h {remainder} min"
            return f"{hours} h"
    if vacation.hours_count not in (None, ""):
        value = float(vacation.hours_count)
        hours = int(value)
        minutes = round((value - hours) * 60)
        return f"{hours} h {minutes} min" if minutes else f"{hours} h"
    return "-"


def _is_overtime(vacation):
    return getattr(vacation, "request_type", "") == "OVERTIME"


def _employee_name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or "-"


def _hline(c, x0, x1, y, color=ACCENT, width=1.2):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x0, y, x1, y)


def _draw_letterhead(c, x0, x1, y, request_number):
    """Encabezado de carta: logo + nombre a la izquierda, numero de solicitud a la derecha."""
    logo_size = _draw_logo(c, x0, y, 38)
    text_x = x0 + logo_size + (10 if logo_size else 0)
    _text(c, text_x, y - 13, COMPANY_NAME, size=12.5, bold=True, color=PRIMARY)
    _text(c, text_x, y - 26, "Gestión de Talento Humano", size=8.3, color=MUTED)

    _text(c, x1, y - 12, request_number, size=11.5, bold=True, color=ACCENT, align="right")
    _text(c, x1, y - 25, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=7.8, color=MUTED, align="right")

    line_y = y - max(logo_size, 30) - 8
    _hline(c, x0, x1, line_y, color=ACCENT, width=1.6)
    return line_y - 16


def _draw_status_banner(c, x0, x1, y, vacation):
    """Banner de estado solido (sin cuadro con borde), tipo carta oficial."""
    h = 40
    status_text = vacation.get_status_display().upper()
    color = _status_color(vacation.status)

    c.setFillColor(color)
    c.rect(x0, y - h, x1 - x0, h, stroke=0, fill=1)

    _text(c, x0 + 14, y - 17, f"SOLICITUD {status_text}", size=13, bold=True, color=WHITE)
    _text(c, x0 + 14, y - 31, f"{_request_type_label(vacation)} · Periodo: {_date_label(vacation.start_date)} - {_date_label(vacation.end_date)}", size=8.3, color=WHITE)

    _text(c, x1 - 14, y - 15, "TIPO DE SOLICITUD", size=7, bold=True, color=WHITE, align="right")
    _text(c, x1 - 14, y - 30, _request_type_label(vacation), size=10.5, bold=True, color=WHITE, align="right")

    return y - h - 16


def _section_title(c, x0, x1, y, number, title):
    _text(c, x0, y, f"{number}.  {title}", size=11, bold=True, color=PRIMARY)
    _hline(c, x0, x1, y - 6, color=LINE, width=0.9)
    return y - 20


def _draw_data_row(c, x0, col_w, y, pairs, row_h=17):
    """Dibuja una fila de pares etiqueta/valor sin cuadros, solo texto alineado en columnas."""
    for index, (label, value) in enumerate(pairs):
        if label is None:
            continue
        cx = x0 + index * col_w
        _text(c, cx, y, label.upper(), size=6.8, bold=True, color=MUTED)
        _text(c, cx, y - 11, _fit_text(value, col_w - 6, font_size=9.2), size=9.2, color=TEXT)
    return y - row_h - 8


def _draw_full_row(c, x0, w, y, label, value, max_lines=2):
    _text(c, x0, y, label.upper(), size=6.8, bold=True, color=MUTED)
    return _draw_wrapped_text(c, x0, y - 11, value, w, size=9.2, leading=12, max_lines=max_lines) - 6


def _draw_applicant_section(c, x0, x1, y, employee):
    w = x1 - x0
    col_w = w / 2
    y = _section_title(c, x0, x1, y, 1, "Datos del Solicitante")
    y = _draw_data_row(c, x0, col_w, y, [
        ("Nombre completo", _employee_name(employee)),
        ("Código empleado", getattr(employee, "employee_code", "") or "-"),
    ])
    y = _draw_data_row(c, x0, col_w, y, [
        ("Cargo", employee.position.name if employee.position_id else "-"),
        ("Departamento", employee.department.name if employee.department_id else "-"),
    ])
    y = _draw_data_row(c, x0, col_w, y, [
        ("Sede", employee.branch.name if employee.branch_id else "-"),
        ("Correo", _safe(employee.email)),
    ])
    return y


def _draw_request_section(c, x0, x1, y, vacation):
    w = x1 - x0
    col_w = w / 2
    y = _section_title(c, x0, x1, y, 2, "Datos de la Solicitud")
    y = _draw_data_row(c, x0, col_w, y, [
        ("N.º Solicitud", vacation.request_number or str(vacation.id)),
        ("Fecha de creación", _datetime_label(vacation.created_at)),
    ])
    y = _draw_data_row(c, x0, col_w, y, [
        ("Subtipo", vacation.get_subtype_display() if vacation.subtype else "-"),
        ("Estado actual", vacation.get_status_display()),
    ])
    y = _draw_data_row(c, x0, col_w, y, [
        ("Fecha desde", _date_label(vacation.start_date)),
        ("Fecha hasta", _date_label(vacation.end_date)),
    ])
    if _is_overtime(vacation):
        y = _draw_data_row(c, x0, col_w, y, [
            ("Hora inicio", _time_label(vacation.start_time)),
            ("Hora fin", _time_label(vacation.end_time)),
        ])
        y = _draw_data_row(c, x0, col_w, y, [
            ("Total horas", _calculate_hours_label(vacation)),
            (None, None),
        ])
    y = _draw_full_row(c, x0, w, y, "Motivo / Descripción", vacation.reason or vacation.description or "Sin descripcion.", max_lines=2)
    return y


def _approval_steps_data(vacation):
    steps = list(vacation.approval_steps.all())
    if steps:
        return [
            {
                "label": step.get_step_display(),
                "status": step.get_status_display(),
                "actor": _safe(getattr(step.user, "email", None)),
                "date": _datetime_label(step.acted_at),
                "detail": _safe(step.comment, "") or ("Pendiente de gestión" if not step.acted_at else "Acción registrada"),
            }
            for step in steps[:4]
        ]
    decisions = [
        ("Administrador", vacation.admin_decision, vacation.admin_decided_by, vacation.admin_decided_at, vacation.admin_comment),
        ("Recursos Humanos", vacation.hr_decision, vacation.hr_decided_by, vacation.hr_decided_at, vacation.hr_comment),
    ]
    result = []
    for role_label, decision, decided_by, decided_at, comment in decisions:
        decision_label = dict(vacation.Status.choices).get(decision, "Pendiente") if decision else "Pendiente"
        result.append({
            "label": role_label,
            "status": decision_label,
            "actor": _safe(getattr(decided_by, "email", None)),
            "date": _datetime_label(decided_at),
            "detail": _safe(comment, "") or ("Pendiente de gestión" if not decided_at else "Acción registrada"),
        })
    return result


def _draw_approval_section(c, x0, x1, y, vacation):
    w = x1 - x0
    y = _section_title(c, x0, x1, y, 3, "Flujo de Aprobación")
    steps = _approval_steps_data(vacation)
    if not steps:
        _text(c, x0, y, "Sin pasos de aprobación registrados.", size=8.7, color=MUTED)
        return y - 14

    count = len(steps)
    col_w = w / count
    row_h = 62
    top_y = y

    for index, step in enumerate(steps):
        cx = x0 + index * col_w
        if index > 0:
            c.setStrokeColor(LINE)
            c.setLineWidth(0.6)
            c.line(cx - 6, top_y + 2, cx - 6, top_y - row_h + 10)

        status_color = _status_color(step["status"])
        c.setFillColor(status_color)
        c.circle(cx + 6, top_y - 5, 4.4, stroke=0, fill=1)
        _text(c, cx + 16, top_y - 8, _fit_text(f"{index + 1}. {step['label']}", col_w - 20, FONT_BOLD, 8.6), size=8.6, bold=True)

        _text(c, cx + 16, top_y - 21, step["status"].upper(), size=7.2, bold=True, color=status_color)
        _text(c, cx + 16, top_y - 33, _fit_text(f"Resp: {step['actor']}", col_w - 22, font_size=7), size=7, color=MUTED)
        _text(c, cx + 16, top_y - 44, _fit_text(step["date"] or "Sin fecha", col_w - 22, font_size=7), size=7, color=MUTED)
        detail_lines = _wrap_lines(step["detail"], col_w - 22, font_size=6.8)
        for line_idx, line in enumerate(detail_lines[:2]):
            _text(c, cx + 16, top_y - 55 - line_idx * 8, line, size=6.8, color=MUTED)

    return top_y - row_h


def _signing_steps(vacation):
    """Pasos con una decision definitiva (aprobado/rechazado) que deben llevar firma,
    en orden: RRHH primero, Administrador/Final despues."""
    decided_statuses = {"APPROVED", "REJECTED"}
    steps = [
        step
        for step in vacation.approval_steps.all()
        if step.step in ("HR", "FINAL") and step.status in decided_statuses and step.user_id and step.acted_at
    ]
    order = {"HR": 0, "FINAL": 1}
    steps.sort(key=lambda step: order.get(step.step, 2))
    return steps[:2]


def _draw_signatures_section(c, x0, x1, y, vacation, image_h=58):
    steps = _signing_steps(vacation)
    w = x1 - x0
    y = _section_title(c, x0, x1, y, 4, "Registro de Firmas")

    if not steps:
        _text(c, x0, y, "Aún no hay firmas registradas para esta solicitud.", size=8.7, color=MUTED)
        return y - 14

    count = len(steps)
    col_w = w / count
    for index, step in enumerate(steps):
        col_x = x0 + index * col_w
        employee = getattr(step.user, "employee_profile", None)
        signer_name = _employee_name(employee) if employee else _safe(getattr(step.user, "email", None))
        signature_file = resolve_signature_file(step=step, employee=employee)
        draw_signature_block(
            c,
            col_x,
            y,
            col_w - 14,
            signature_file=signature_file,
            signer_name=signer_name,
            role_label=f"{step.get_step_display()} · {step.get_status_display()}",
            decided_at=step.acted_at,
            image_h=image_h,
        )
    return y - signature_block_height(image_h) - 8


def render_request_pdf(vacation):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Solicitud {vacation.request_number or vacation.id}")

    page_w, page_h = letter
    x0, x1 = 46, page_w - 46
    y = page_h - 40

    employee = vacation.employee

    y = _draw_letterhead(c, x0, x1, y, vacation.request_number or str(vacation.id))
    y = _draw_status_banner(c, x0, x1, y, vacation)
    y = _draw_applicant_section(c, x0, x1, y, employee)
    y -= 6
    y = _draw_request_section(c, x0, x1, y, vacation)
    y -= 6
    y = _draw_approval_section(c, x0, x1, y, vacation)
    y -= 10

    signatures_h = 20 + signature_block_height(58) + 14
    if y - signatures_h < 60:
        c.showPage()
        y = page_h - 40
    y = _draw_signatures_section(c, x0, x1, y, vacation)

    c.setFillColor(MUTED)
    c.setFont(FONT, 7.2)
    c.drawCentredString(page_w / 2, 26, f"Documento oficial · {COMPANY_NAME} · Válido con firmas digitales registradas.")

    c.save()
    buffer.seek(0)
    return buffer
