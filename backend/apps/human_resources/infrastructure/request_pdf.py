import io
import os
from datetime import datetime

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

NAVY = HexColor("#1b3a6b")
STEEL = HexColor("#2e6da4")
TEXT = HexColor("#1a1a1a")
MUTED = HexColor("#5d6d7e")
RULE = HexColor("#c8d8e8")
SUCCESS = HexColor("#1f8a4c")
WARNING = HexColor("#b7791f")
DANGER = HexColor("#b3261e")
NEUTRAL = HexColor("#5d6d7e")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


# ── Utilidades de dato ─────────────────────────────────────────────────────────
def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _employee_name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _date_label(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _datetime_label(value):
    return f"{value:%d/%m/%Y %H:%M}" if value else "-"


def _time_label(value):
    return f"{value:%H:%M}" if value else "-"


def _request_type_label(vacation):
    return _safe(vacation.get_request_type_display())


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


def _status_color(status):
    status = _safe(status, "").upper()
    if "APROB" in status or status in {"APPROVED", "FINALIZED"}:
        return SUCCESS
    if "RECHAZ" in status or "CANCEL" in status or status in {"REJECTED", "CANCELLED"}:
        return DANGER
    if "PEND" in status or "REVIS" in status or status in {"PENDING", "IN_REVIEW", "PENDING_HR", "PENDING_ADMIN"}:
        return WARNING
    return NEUTRAL


# ── Texto ──────────────────────────────────────────────────────────────────────
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


def _draw_wrapped_text(c, x, y, text, max_width, size=9, leading=None, color=TEXT):
    leading = leading or size + 3
    lines = _wrap_lines(text, max_width, FONT, size)
    c.setFillColor(color)
    c.setFont(FONT, size)
    for idx, line in enumerate(lines):
        c.drawString(x, y - (idx * leading), line)
    return y - (len(lines) * leading)


def _parse_runs(parts):
    tokens = []
    for text, bold in parts:
        words = text.split(" ")
        for idx, word in enumerate(words):
            if idx > 0:
                tokens.append((" ", bold))
            if word:
                tokens.append((word, bold))
    return tokens


def _draw_rich_paragraph(c, x, y, parts, max_width, size=10, leading=15, align="justify"):
    """Parrafo de texto corrido con tramos en negrita (mismo estilo que el certificado laboral)."""
    tokens = _parse_runs(parts)

    lines = []
    current_line = []
    current_width = 0.0
    for word, bold in tokens:
        word_width = stringWidth(word, FONT_BOLD if bold else FONT, size)
        if word != " " and current_width + word_width > max_width and current_line:
            while current_line and current_line[-1][0] == " ":
                current_line.pop()
            lines.append(current_line)
            current_line = []
            current_width = 0.0
        current_line.append((word, bold))
        current_width += word_width
    if current_line:
        while current_line and current_line[-1][0] == " ":
            current_line.pop()
        lines.append(current_line)

    c.setFillColor(TEXT)
    for line_idx, line in enumerate(lines):
        line_y = y - line_idx * leading
        is_last = line_idx == len(lines) - 1
        natural_w = sum(stringWidth(w, FONT_BOLD if b else FONT, size) for w, b in line)
        gap_count = sum(1 for w, _ in line if w == " ")
        extra_per_gap = (
            (max(max_width - natural_w, 0) / gap_count)
            if (align == "justify" and not is_last and gap_count)
            else 0
        )
        cursor_x = x
        for word, bold in line:
            if word == " ":
                cursor_x += stringWidth(" ", FONT, size) + extra_per_gap
                continue
            c.setFont(FONT_BOLD if bold else FONT, size)
            c.drawString(cursor_x, line_y, word)
            cursor_x += stringWidth(word, FONT_BOLD if bold else FONT, size)

    return y - len(lines) * leading


# ── Imagenes ───────────────────────────────────────────────────────────────────
def _draw_logo(c, x, y, size=40):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        c.drawImage(ImageReader(LOGO_PATH), x, y - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except Exception:
        return 0
    return size


def _draw_signature_image(c, x, y, max_w, max_h, signature_file):
    if not signature_file:
        return 0
    try:
        if not signature_file.storage.exists(signature_file.name):
            return 0
        with signature_file.open("rb") as fobj:
            image = ImageReader(io.BytesIO(fobj.read()))
        iw, ih = image.getSize()
        draw_w = max_w
        draw_h = draw_w * (ih / iw) if iw else max_h
        if draw_h > max_h:
            draw_h = max_h
            draw_w = draw_h * (iw / ih) if ih else max_w
        c.drawImage(image, x, y, width=draw_w, height=draw_h, preserveAspectRatio=True, mask="auto")
        return draw_h
    except Exception:
        return 0


def _draw_signature_block(c, x0, y_anchor, w, signer_name, role_label, signature_file):
    """Bloque de firma con franja punteada decorativa (mismo estilo que el certificado laboral)."""
    _draw_signature_image(c, x0, y_anchor + 10, min(w, 200), 56, signature_file)

    dot_y = y_anchor + 6
    dot_x = x0
    dot_end = x0 + min(w, 220)
    c.setFillColor(RULE)
    step = 5
    while dot_x < dot_end:
        c.rect(dot_x, dot_y, 2.5, 1.2, stroke=0, fill=1)
        dot_x += step

    c.setFont(FONT_BOLD, 10)
    c.setFillColor(NAVY)
    c.drawString(x0, y_anchor - 10, signer_name.upper())
    c.setFont(FONT, 8.3)
    c.setFillColor(MUTED)
    c.drawString(x0, y_anchor - 22, role_label)


# ── Encabezado ─────────────────────────────────────────────────────────────────
def _draw_letterhead(c, x0, x1, y, request_number):
    logo_size = _draw_logo(c, x0, y, 36)
    text_x = x0 + logo_size + (10 if logo_size else 0)
    _text(c, text_x, y - 12, COMPANY_NAME, size=12, bold=True, color=NAVY)
    _text(c, text_x, y - 25, "Gestión de Talento Humano", size=8.2, color=MUTED)

    _text(c, x1, y - 12, request_number, size=11, bold=True, color=STEEL, align="right")
    _text(c, x1, y - 25, f"Generado el {timezone.now():%d/%m/%Y a las %H:%M}", size=7.6, color=MUTED, align="right")

    return y - max(logo_size, 30) - 22


def _draw_title(c, cx, y, vacation):
    _text(c, cx, y, "CONSTANCIA DE SOLICITUD", size=15, bold=True, color=NAVY, align="center")
    status_color = _status_color(vacation.status)
    _text(c, cx, y - 16, vacation.get_status_display().upper(), size=9.5, bold=True, color=status_color, align="center")
    return y - 34


# ── Cuerpo narrativo ───────────────────────────────────────────────────────────
def _draw_body(c, x0, x1, y, vacation, employee):
    w = x1 - x0
    today = timezone.now()

    hire_area = employee.department.name if employee.department_id else "la organización"
    hire_position = employee.position.name if employee.position_id else "colaborador(a)"
    hire_branch = employee.branch.name if employee.branch_id else "-"

    intro_parts = [
        ("Por medio del presente documento se deja constancia de que la solicitud de", False),
        (f" {_request_type_label(vacation)} ", True),
        (f"identificada con el número", False),
        (f" {vacation.request_number or str(vacation.id)}, ", True),
        (f"presentada por", False),
        (f" {_employee_name(employee).upper()}, ", True),
        (f"con código de empleado {getattr(employee, 'employee_code', '') or '-'}, quien se desempeña como", False),
        (f" {hire_position} ", True),
        (f"en el área de {hire_area}, sede {hire_branch}, fue registrada el {vacation.created_at:%d/%m/%Y a las %H:%M} y actualmente se encuentra en estado", False),
        (f" {vacation.get_status_display().upper()}.", True),
    ]
    y = _draw_rich_paragraph(c, x0, y, intro_parts, w, size=10, leading=15)
    y -= 14

    period_parts = [
        ("El periodo solicitado comprende desde el", False),
        (f" {_date_label(vacation.start_date)} ", True),
        ("hasta el", False),
        (f" {_date_label(vacation.end_date)}.", True),
    ]
    if _is_overtime(vacation):
        period_parts += [
            (" El horario registrado va de", False),
            (f" {_time_label(vacation.start_time)} ", True),
            ("a", False),
            (f" {_time_label(vacation.end_time)}, ", True),
            ("para un total de", False),
            (f" {_calculate_hours_label(vacation)}.", True),
        ]
    y = _draw_rich_paragraph(c, x0, y, period_parts, w, size=10, leading=15)
    y -= 14

    reason = vacation.reason or vacation.description or "No se registró un motivo adicional."
    reason_parts = [("Motivo o descripción registrada por el(la) solicitante: ", True), (f"“{reason}”", False)]
    y = _draw_rich_paragraph(c, x0, y, reason_parts, w, size=10, leading=15, align="left")
    y -= 18

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
                "detail": _safe(step.comment, "") or ("pendiente de gestión" if not step.acted_at else "acción registrada"),
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
            "detail": _safe(comment, "") or ("pendiente de gestión" if not decided_at else "acción registrada"),
        })
    return result


def _draw_approval_narrative(c, x0, x1, y, vacation):
    """Flujo de aprobación narrado como texto corrido, sin cuadros ni marcadores graficos."""
    w = x1 - x0
    _text(c, x0, y, "Trazabilidad del proceso de aprobación", size=10.5, bold=True, color=NAVY)
    y -= 16

    steps = _approval_steps_data(vacation)
    if not steps:
        _text(c, x0, y, "Aún no se han registrado pasos de aprobación para esta solicitud.", size=9, color=MUTED)
        return y - 14

    for index, step in enumerate(steps, start=1):
        status_color = _status_color(step["status"])
        # Etapa + estado en una linea (estado con color de estado, resto en texto normal)
        c.setFont(FONT_BOLD, 9.3)
        c.setFillColor(NAVY)
        c.drawString(x0, y, f"{index}. {step['label']}:")
        label_w = stringWidth(f"{index}. {step['label']}: ", FONT_BOLD, 9.3)
        c.setFont(FONT_BOLD, 9.3)
        c.setFillColor(status_color)
        c.drawString(x0 + label_w, y, step["status"])
        y -= 12

        detail_text = f"Responsable: {step['actor']}  ·  Fecha: {step['date'] or 'sin fecha'}  ·  {step['detail']}"
        y = _draw_wrapped_text(c, x0 + 10, y, detail_text, w - 10, size=8.3, leading=11, color=MUTED)
        y -= 8

    return y


def _signing_steps(vacation):
    decided_statuses = {"APPROVED", "REJECTED"}
    steps = [
        step
        for step in vacation.approval_steps.all()
        if step.step in ("HR", "FINAL") and step.status in decided_statuses and step.user_id and step.acted_at
    ]
    order = {"HR": 0, "FINAL": 1}
    steps.sort(key=lambda step: order.get(step.step, 2))
    return steps[:2]


def _draw_signatures_section(c, x0, x1, y, vacation):
    w = x1 - x0
    _text(c, x0, y, "Firmas de aprobación", size=10.5, bold=True, color=NAVY)
    y -= 20

    steps = _signing_steps(vacation)
    if not steps:
        _text(c, x0, y, "Aún no hay firmas registradas para esta solicitud.", size=9, color=MUTED)
        return y - 14

    count = len(steps)
    col_w = w / count
    for index, step in enumerate(steps):
        col_x = x0 + index * col_w
        employee = getattr(step.user, "employee_profile", None)
        signer_name = _employee_name(employee) if employee else _safe(getattr(step.user, "email", None))
        signature_file = getattr(step, "signature", None) or (getattr(employee, "signature", None) if employee else None)
        _draw_signature_block(
            c,
            col_x,
            y,
            col_w - 20,
            signer_name,
            f"{step.get_step_display()} · {step.get_status_display()} · {_datetime_label(step.acted_at)}",
            signature_file,
        )
    return y - 66


def render_request_pdf(vacation):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Solicitud {vacation.request_number or vacation.id}")

    page_w, page_h = letter
    x0, x1 = 64, page_w - 64
    cx = (x0 + x1) / 2
    y = page_h - 52

    employee = vacation.employee

    y = _draw_letterhead(c, x0, x1, y, vacation.request_number or str(vacation.id))
    y = _draw_title(c, cx, y, vacation)
    y = _draw_body(c, x0, x1, y, vacation, employee)
    y = _draw_approval_narrative(c, x0, x1, y, vacation)
    y -= 8

    if y - 100 < 70:
        c.showPage()
        y = page_h - 52

    y = _draw_signatures_section(c, x0, x1, y, vacation)

    c.setFillColor(MUTED)
    c.setFont(FONT, 7.2)
    c.drawCentredString(page_w / 2, 30, f"Documento oficial · {COMPANY_NAME} · Válido con firmas digitales registradas.")

    c.save()
    buffer.seek(0)
    return buffer
