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
BRAND = HexColor("#2a4038")
TEXT = HexColor("#111827")
MUTED = HexColor("#6b7280")
LINE = HexColor("#e5e7eb")
CARD = HexColor("#f7faf8")
SUBTLE = HexColor("#fbfcfb")
HEADER_BG = HexColor("#eef4f1")
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


def _text(c, x, y, text, size=9, bold=False, align="left", color=TEXT):
    c.setFillColor(color)
    c.setFont(_font(bold), size)
    text = _safe(text, "")
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def _fit(text, max_width, font_name="Helvetica", font_size=9):
    text = _safe(text, "")
    if stringWidth(text, font_name, font_size) <= max_width:
        return text
    suffix = "..."
    while text and stringWidth(text + suffix, font_name, font_size) > max_width:
        text = text[:-1]
    return text + suffix if text else suffix


def _round_rect(c, x, y, w, h, fill_color=WHITE, stroke_color=LINE, radius=8):
    c.setFillColor(fill_color)
    c.setStrokeColor(stroke_color)
    c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def _section_label(c, x, y, title):
    _text(c, x, y, title.upper(), size=8.5, bold=True, color=BRAND)


def _field(c, x, y, label, value, max_width):
    _text(c, x, y, label.upper(), size=6.8, bold=True, color=MUTED)
    _text(c, x, y - 12, _fit(value, max_width, font_size=9), size=9, color=TEXT)


def _pill(c, x, y, text, color, w=None):
    text = _safe(text, "-")
    w = w or max(58, stringWidth(text, "Helvetica-Bold", 7.3) + 16)
    c.setFillColor(color)
    c.setStrokeColor(color)
    c.roundRect(x, y - 9, w, 14, 7, stroke=1, fill=1)
    _text(c, x + w / 2, y - 5, text, size=7.3, bold=True, align="center", color=WHITE)
    return w


def _status_color(status):
    status = _safe(status, "").upper()
    if status in {"ACTIVE", "LOADED", "COMPLETE", "DOCUMENTED"}:
        return SUCCESS
    if status in {"TERMINATED", "RETIRED", "REJECTED", "EXPIRED"}:
        return DANGER
    if status in {"SUSPENDED", "LEAVE", "PENDING", "DRAFT", "INCOMPLETE"}:
        return WARNING
    return NEUTRAL


def _draw_logo(c, x, y, size=42):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        c.drawImage(ImageReader(LOGO_PATH), x, y - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except (OSError, ValueError):
        return 0
    return size


def _name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _date(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _datetime(value):
    return f"{value:%d/%m/%Y %H:%M}" if value else "-"


def _money(value):
    if value in (None, ""):
        return "-"
    return f"${value:,.0f}"


def _hours(value):
    if value in (None, ""):
        return "-"
    value = float(value)
    text = f"{value:.1f}".rstrip("0").rstrip(".")
    return f"{text} h/semana"


def _draw_header(c, x0, x1, y, employee):
    logo_size = _draw_logo(c, x0, y - 13, size=42)
    text_x = x0 + logo_size + (12 if logo_size else 0)
    _text(c, text_x, y - 28, COMPANY_NAME, size=13.5, bold=True)
    _text(c, x1, y - 22, "Perfil de empleado", size=12, bold=True, align="right", color=BRAND)
    _text(c, x1, y - 38, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=8.5, align="right", color=MUTED)
    status_text = employee.get_status_display()
    pill_w = max(84, stringWidth(status_text, "Helvetica-Bold", 7.3) + 18)
    _pill(c, x1 - pill_w, y - 53, status_text, _status_color(employee.status), pill_w)


def _draw_summary_card(c, x0, y, w, employee):
    h = 54
    _round_rect(c, x0, y - h, w, h, fill_color=CARD, stroke_color=LINE, radius=8)
    department = employee.department.name if employee.department_id else "-"
    position = employee.position.name if employee.position_id else "-"
    _field(c, x0 + 14, y - 17, "Empleado", _name(employee), 150)
    _field(c, x0 + 172, y - 17, "Codigo", employee.employee_code or "-", 100)
    _field(c, x0 + 280, y - 17, "Cargo", position, 140)
    _field(c, x0 + 428, y - 17, "Area", department, 110)
    return y - h


def _draw_info_card(c, x, y, w, title, fields):
    row_h = 31
    rows = (len(fields) + 1) // 2
    h = 28 + rows * row_h
    _round_rect(c, x, y - h, w, h, fill_color=WHITE, stroke_color=LINE, radius=8)
    _section_label(c, x + 14, y - 16, title)
    col_w = (w - 34) / 2
    for idx, (label, value) in enumerate(fields):
        col = idx % 2
        row = idx // 2
        fx = x + 14 + col * (col_w + 12)
        fy = y - 39 - row * row_h
        _field(c, fx, fy, label, value, col_w)
    return y - h


def _draw_documents_card(c, x, y, w, documents):
    row_h = 20
    visible = documents[:8]
    h = 34 + max(len(visible), 1) * row_h
    _round_rect(c, x, y - h, w, h, fill_color=WHITE, stroke_color=LINE, radius=8)
    _section_label(c, x + 14, y - 16, "Documentos del expediente")
    _text(c, x + w - 14, y - 16, f"{len(documents)} registrado(s)", size=7.4, align="right", color=MUTED)

    if not visible:
        _text(c, x + 14, y - 34, "Sin documentos cargados.", size=8.5, color=MUTED)
        return y - h

    name_w = w * 0.34
    type_w = w * 0.26
    date_w = w * 0.18
    status_w = w - name_w - type_w - date_w - 28

    current_y = y - 34
    for index, document in enumerate(visible):
        if index % 2:
            c.setFillColor(SUBTLE)
            c.rect(x + 6, current_y - row_h + 6, w - 12, row_h, stroke=0, fill=1)
        cursor = x + 14
        _text(c, cursor, current_y - 5, _fit(document.name, name_w - 6, size=7.6), size=7.6, bold=True)
        cursor += name_w
        _text(c, cursor, current_y - 5, _fit(document.get_document_type_display(), type_w - 6, size=7.2), size=7.2, color=MUTED)
        cursor += type_w
        _text(c, cursor, current_y - 5, _date(document.expires_at), size=7.2, color=MUTED)
        cursor += date_w
        status_label = document.get_status_display()
        _pill(c, cursor, current_y - 2, status_label, _status_color(document.status), min(status_w, 74))
        current_y -= row_h

    if len(documents) > len(visible):
        _text(c, x + 14, current_y + 4, f"+ {len(documents) - len(visible)} documento(s) adicional(es) no mostrados.", size=7.4, bold=True, color=MUTED)

    return y - h


def render_employee_profile_pdf(employee):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Perfil de {_name(employee)}")

    page_w, page_h = letter
    x0, x1 = 40, page_w - 40
    main_w = x1 - x0
    y = page_h - 36

    _draw_header(c, x0, x1, y, employee)
    y -= 82
    y = _draw_summary_card(c, x0, y, main_w, employee)
    y -= 14

    personal_fields = [
        ("Documento", " ".join(part for part in (employee.get_document_type_display() if employee.document_type else "", _safe(employee.document_number, "")) if part) or "-"),
        ("Fecha de expedicion", _date(employee.document_issue_date)),
        ("Lugar de expedicion", _safe(employee.document_issue_place)),
        ("Fecha de nacimiento", _date(employee.date_of_birth)),
        ("Nacionalidad", _safe(employee.nationality)),
        ("Genero", employee.get_gender_display() if employee.gender else "-"),
        ("Estado civil", employee.get_marital_status_display() if employee.marital_status else "-"),
        ("Telefono", _safe(employee.phone)),
        ("Correo", _safe(employee.email)),
        ("Ciudad", _safe(employee.city)),
        ("Departamento (residencia)", _safe(employee.residence_department)),
        ("Direccion", _safe(employee.address)),
    ]

    labor_fields = [
        ("Sede", employee.branch.name if employee.branch_id else "-"),
        ("Tipo de vinculacion", employee.get_employment_type_display()),
        ("Tipo de contrato", employee.get_contract_type_display()),
        ("Modalidad de trabajo", employee.get_work_modality_display() if employee.work_modality else "-"),
        ("Fecha de ingreso", _date(employee.hire_date)),
        ("Antiguedad", f"{employee.seniority_days} dias" if employee.seniority_days is not None else "-"),
        ("Salario base", _money(employee.base_salary)),
        ("Tipo de salario", employee.get_salary_type_display()),
        ("Horas semanales", _hours(employee.weekly_working_hours)),
        ("Centro de costo", _safe(employee.cost_center)),
        ("Auxilio de transporte", "Aplica" if employee.transport_allowance_applies else "No aplica"),
        ("Salario integral", "Si" if employee.integral_salary else "No"),
    ]

    social_security_fields = [
        ("EPS", _safe(employee.eps)),
        ("Fondo de pension", _safe(employee.pension_fund)),
        ("Fondo de cesantias", _safe(employee.severance_fund)),
        ("ARL", _safe(employee.arl)),
        ("Nivel de riesgo ARL", _safe(employee.arl_risk_level)),
        ("Caja de compensacion", _safe(employee.compensation_fund)),
    ]

    banking_fields = [
        ("Banco", _safe(employee.bank_name)),
        ("Tipo de cuenta", employee.get_bank_account_type_display() if employee.bank_account_type else "-"),
        ("Numero de cuenta", _safe(employee.bank_account_number)),
        ("Titular", _safe(employee.bank_account_holder)),
        ("Documento del titular", _safe(employee.bank_account_holder_document)),
    ]

    emergency_fields = [
        ("Nombre", _safe(employee.emergency_contact_name)),
        ("Parentesco", _safe(employee.emergency_contact_relationship)),
        ("Celular", _safe(employee.emergency_contact_mobile)),
        ("Telefono alterno", _safe(employee.emergency_contact_alternate_phone)),
        ("Direccion", _safe(employee.emergency_contact_address)),
    ]

    left_w = (main_w - 12) / 2
    left_bottom = _draw_info_card(c, x0, y, left_w, "Datos personales", personal_fields)
    right_bottom = _draw_info_card(c, x0 + left_w + 12, y, left_w, "Datos laborales", labor_fields)
    y = min(left_bottom, right_bottom) - 14

    if y < 220:
        c.showPage()
        y = page_h - 40

    left_bottom = _draw_info_card(c, x0, y, left_w, "Seguridad social", social_security_fields)
    right_bottom = _draw_info_card(c, x0 + left_w + 12, y, left_w, "Datos bancarios", banking_fields)
    y = min(left_bottom, right_bottom) - 14

    if y < 220:
        c.showPage()
        y = page_h - 40

    y = _draw_info_card(c, x0, y, main_w, "Contacto de emergencia", emergency_fields)
    y -= 14

    documents = list(employee.documents.order_by("-uploaded_at"))
    if y < 160:
        c.showPage()
        y = page_h - 40
    y = _draw_documents_card(c, x0, y, main_w, documents)

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawCentredString(page_w / 2, 24, "Documento generado automaticamente para control interno de Recursos Humanos.")

    c.save()
    buffer.seek(0)
    return buffer
