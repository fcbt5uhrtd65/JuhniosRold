import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
BRAND_COLOR = HexColor("#2a4038")
BRAND_COLOR_LIGHT = HexColor("#eef2f0")


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _font(bold=False):
    return "Helvetica-Bold" if bold else "Helvetica"


def _draw_text(c, x, y, text, size=9, bold=False, align="left"):
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


def _draw_wrapped_text(c, x, y, text, max_width, size=9, bold=False, leading=None, max_lines=None):
    font_name = _font(bold)
    leading = leading or size + 3
    lines = _wrap_lines(text, max_width, font_name, size)
    truncated = bool(max_lines) and len(lines) > max_lines
    if max_lines:
        lines = lines[:max_lines]
    if truncated and lines:
        lines[-1] = _fit_text(f"{lines[-1]} …", max_width, font_name, size)
    c.setFont(font_name, size)
    for idx, line in enumerate(lines):
        c.drawString(x, y - (idx * leading), line)
    return y - (len(lines) * leading)


def _draw_label_value(c, x, y, label, value, label_w=110, size=9, max_width=150):
    _draw_text(c, x, y, label, size=size, bold=True)
    _draw_text(c, x + label_w, y, _fit_text(value, max_width, font_size=size), size=size)


def _draw_rect(c, x, y, w, h):
    c.rect(x, y, w, h, stroke=1, fill=0)


def _draw_section_title(c, x, y, title, width):
    c.setFillColor(BRAND_COLOR)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(x, y, title.upper())
    c.setStrokeColor(BRAND_COLOR)
    c.setLineWidth(1.4)
    c.line(x, y - 5, x + width, y - 5)
    c.setStrokeColor(HexColor("#000000"))
    c.setLineWidth(1)
    c.setFillColor(HexColor("#000000"))


def render_request_pdf(vacation):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Solicitud {vacation.request_number or vacation.id}")

    page_w, page_h = letter
    x0, x1 = 40, page_w - 40
    main_w = x1 - x0
    y = page_h - 50

    # Encabezado
    c.setFillColor(BRAND_COLOR)
    c.rect(x0, y - 4, main_w, 3, stroke=0, fill=1)
    c.setFillColor(HexColor("#000000"))
    y -= 14
    _draw_text(c, x0, y, COMPANY_NAME, size=13, bold=True)
    c.setFillColor(BRAND_COLOR)
    _draw_text(c, x1, y, "DOCUMENTO DE SOLICITUD", size=12, bold=True, align="right")
    c.setFillColor(HexColor("#000000"))
    y -= 16
    _draw_text(c, x0, y, "Recursos Humanos", size=9)
    _draw_text(c, x1, y, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=9, align="right")
    y -= 10
    c.line(x0, y, x1, y)
    y -= 24

    employee = vacation.employee
    employee_name = f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or "-"

    _draw_section_title(c, x0, y, "Datos del solicitante", main_w)
    y -= 22
    _draw_label_value(c, x0, y, "Nombre:", employee_name)
    _draw_label_value(c, x0 + main_w / 2, y, "Código:", getattr(employee, "employee_code", "") or "-")
    y -= 16
    _draw_label_value(c, x0, y, "Cargo:", employee.position.name if employee.position_id else "-")
    _draw_label_value(c, x0 + main_w / 2, y, "Departamento:", employee.department.name if employee.department_id else "-")
    y -= 16
    _draw_label_value(c, x0, y, "Sede:", employee.branch.name if employee.branch_id else "-", max_width=main_w - 110)
    y -= 28

    _draw_section_title(c, x0, y, "Datos de la solicitud", main_w)
    y -= 22
    _draw_label_value(c, x0, y, "N.º de solicitud:", vacation.request_number or str(vacation.id))
    _draw_label_value(c, x0 + main_w / 2, y, "Fecha de creación:", f"{vacation.created_at:%d/%m/%Y %H:%M}")
    y -= 16
    _draw_label_value(c, x0, y, "Tipo:", vacation.get_request_type_display())
    _draw_label_value(c, x0 + main_w / 2, y, "Subtipo:", vacation.get_subtype_display() if vacation.subtype else "-")
    y -= 16
    _draw_label_value(c, x0, y, "Desde:", f"{vacation.start_date:%d/%m/%Y}" if vacation.start_date else "-")
    _draw_label_value(c, x0 + main_w / 2, y, "Hasta:", f"{vacation.end_date:%d/%m/%Y}" if vacation.end_date else "-")
    y -= 16
    _draw_label_value(c, x0, y, "Estado actual:", vacation.get_status_display(), max_width=main_w - 110)
    y -= 20

    _draw_section_title(c, x0, y, "Motivo / descripción", main_w)
    y -= 18
    y = _draw_wrapped_text(c, x0, y, vacation.reason or vacation.description or "Sin descripción.", main_w, size=9, max_lines=4)
    y -= 22

    _draw_section_title(c, x0, y, "Historial de aprobación", main_w)
    y -= 20
    c.setFillColor(BRAND_COLOR_LIGHT)
    c.rect(x0, y - 2, main_w, 14, stroke=0, fill=1)
    c.setFillColor(HexColor("#000000"))
    _draw_rect(c, x0, y - 2, main_w, 14)
    _draw_text(c, x0 + 6, y + 2, "Responsable", size=8, bold=True)
    _draw_text(c, x0 + 160, y + 2, "Decisión", size=8, bold=True)
    _draw_text(c, x0 + 260, y + 2, "Fecha", size=8, bold=True)
    _draw_text(c, x0 + 360, y + 2, "Comentario", size=8, bold=True)
    y -= 16

    decisions = [
        ("Administrador", vacation.admin_decision, vacation.admin_decided_by, vacation.admin_decided_at, vacation.admin_comment),
        ("Recursos Humanos", vacation.hr_decision, vacation.hr_decided_by, vacation.hr_decided_at, vacation.hr_comment),
    ]
    for role_label, decision, decided_by, decided_at, comment in decisions:
        decided_by_name = _safe(getattr(decided_by, "email", None), "-")
        decision_label = dict(vacation.Status.choices).get(decision, "Sin resolver") if decision else "Sin resolver"
        decided_at_label = f"{decided_at:%d/%m/%Y %H:%M}" if decided_at else "-"
        _draw_text(c, x0 + 6, y, role_label, size=8)
        _draw_text(c, x0 + 160, y, decision_label, size=8)
        _draw_text(c, x0 + 260, y, decided_at_label, size=8)
        _draw_text(c, x0 + 360, y, _fit_text(f"{decided_by_name}: {comment}" if comment else decided_by_name, main_w - 366, font_size=8), size=8)
        y -= 14

    y -= 10
    all_steps = list(vacation.approval_steps.all())
    for index, step in enumerate(all_steps):
        if y < 80:
            remaining = len(all_steps) - index
            _draw_text(c, x0, y, f"+ {remaining} paso(s) adicional(es) no mostrado(s) por espacio.", size=8, bold=True)
            break
        step_user = _safe(getattr(step.user, "email", None), "-")
        step_label = f"{step.get_step_display()}: {step.get_status_display()} — {step_user}"
        y = _draw_wrapped_text(c, x0, y, step_label, main_w, size=8, max_lines=1)
        y -= 12

    c.setFont("Helvetica", 7)
    c.drawCentredString(page_w / 2, 30, "Documento generado automáticamente para control interno de Recursos Humanos.")

    c.save()
    buffer.seek(0)
    return buffer
