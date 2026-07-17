import io
import os

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from shared.infrastructure.signature_pdf import draw_signature_block, signature_block_height

from .models import Employee

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
COMPANY_NIT = "NIT en registro interno"
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
GOLD = HexColor("#b08d3f")


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _date(value):
    return f"{value:%d de %B de %Y}" if value else "-"


def _short_date(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _money(value):
    if value in (None, ""):
        return "-"
    return f"${value:,.0f} COP"


def _text(c, x, y, text, size=9, bold=False, color=TEXT, align="left", font="Helvetica"):
    c.setFillColor(color)
    c.setFont(f"{font}-Bold" if bold else font, size)
    text = _safe(text, "")
    if align == "right":
        c.drawRightString(x, y, text)
    elif align == "center":
        c.drawCentredString(x, y, text)
    else:
        c.drawString(x, y, text)


def _wrap_lines(text, max_width, font_name="Helvetica", font_size=10.5, leading=None):
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


def _draw_paragraph(c, x, y, text, max_width, size=10.5, leading=16, color=TEXT):
    lines = _wrap_lines(text, max_width, font_size=size)
    c.setFillColor(color)
    c.setFont("Helvetica", size)
    for idx, line in enumerate(lines):
        c.drawString(x, y - idx * leading, line)
    return y - len(lines) * leading


def _draw_logo(c, x, y, size=48):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        c.drawImage(ImageReader(LOGO_PATH), x, y - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except Exception:
        return 0
    return size


def _draw_page_frame(c, x0, x1, page_h, top_y, bottom_y):
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.rect(x0 - 14, bottom_y - 14, (x1 - x0) + 28, (top_y - bottom_y) + 28, stroke=1, fill=0)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.rect(x0 - 10, bottom_y - 10, (x1 - x0) + 20, (top_y - bottom_y) + 20, stroke=1, fill=0)


def _draw_letterhead(c, x0, x1, y, certificate_number):
    logo_size = _draw_logo(c, x0, y, 48)
    text_x = x0 + logo_size + (12 if logo_size else 0)
    _text(c, text_x, y - 16, COMPANY_NAME, size=13.5, bold=True)
    _text(c, text_x, y - 30, "Recursos Humanos · Gestión del Talento Humano", size=8.5, color=MUTED)
    _text(c, x1, y - 16, "CERTIFICADO No.", size=7.5, bold=True, color=MUTED, align="right")
    _text(c, x1, y - 28, certificate_number, size=10.5, bold=True, color=BRAND, align="right")
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.4)
    c.line(x0, y - 44, x1, y - 44)
    return y - 60


def _draw_title(c, x0, x1, y):
    _text(c, (x0 + x1) / 2, y, "CERTIFICADO LABORAL", size=17, bold=True, color=BRAND, align="center")
    label_w = stringWidth("CERTIFICADO LABORAL", "Helvetica-Bold", 17)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    mid_x = (x0 + x1) / 2
    c.line(mid_x - label_w / 2, y - 8, mid_x + label_w / 2, y - 8)
    return y - 24


def _draw_field_row(c, x, y, w, label, value):
    _text(c, x, y, label.upper(), size=6.8, bold=True, color=MUTED)
    _text(c, x, y - 12, _safe(value), size=9.5, bold=True, color=TEXT)


def _draw_summary_grid(c, x0, y, w, employee):
    rows = [
        [("Nombre completo", _name(employee)), ("Documento", f"{employee.get_document_type_display() if employee.document_type else ''} {_safe(employee.document_number)}".strip())],
        [("Cargo", employee.position.name if employee.position_id else "-"), ("Área / Departamento", employee.department.name if employee.department_id else "-")],
        [("Tipo de vinculación", employee.get_employment_type_display()), ("Tipo de contrato", employee.get_contract_type_display())],
        [("Fecha de ingreso", _short_date(employee.hire_date)), ("Sede", employee.branch.name if employee.branch_id else "-")],
    ]
    row_h = 34
    h = 20 + len(rows) * row_h
    c.setFillColor(CARD)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.roundRect(x0, y - h, w, h, 8, stroke=1, fill=1)
    col_w = (w - 40) / 2
    current_y = y - 22
    for row in rows:
        _draw_field_row(c, x0 + 18, current_y, col_w, *row[0])
        _draw_field_row(c, x0 + 18 + col_w + 22, current_y, col_w, *row[1])
        current_y -= row_h
    return y - h


def _certificate_number(employee: Employee) -> str:
    today = timezone.localdate()
    code = (employee.employee_code or str(employee.id)[:8]).replace(" ", "")
    return f"CL-{today:%Y%m}-{code}"


def render_employee_certificate_pdf(employee: Employee, issued_by: Employee | None = None, include_salary: bool = True):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Certificado laboral - {_name(employee)}")

    page_w, page_h = letter
    x0, x1 = 62, page_w - 62
    main_w = x1 - x0
    top_y = page_h - 56
    bottom_y = 60
    y = page_h - 62

    _draw_page_frame(c, x0, x1, page_h, top_y, bottom_y)

    y = _draw_letterhead(c, x0, x1, y, _certificate_number(employee))
    y -= 10
    y = _draw_title(c, x0, x1, y)
    y -= 22

    today = timezone.localdate()
    intro = (
        f"{COMPANY_NAME} certifica que {_name(employee)}, identificado(a) con "
        f"{employee.get_document_type_display() if employee.document_type else 'documento'} "
        f"N.° {_safe(employee.document_number)}, labora actualmente en la compañía desempeñando el cargo de "
        f"{employee.position.name if employee.position_id else 'un cargo asignado'}, en el área de "
        f"{employee.department.name if employee.department_id else 'la organización'}, "
        f"desde el {_short_date(employee.hire_date)}, bajo un contrato de tipo "
        f"{employee.get_contract_type_display().lower()}."
    )
    y = _draw_paragraph(c, x0, y, intro, main_w, size=10.5, leading=15.5)
    y -= 18

    if include_salary and employee.base_salary:
        salary_text = (
            f"Actualmente devenga un salario {employee.get_salary_type_display().lower()} de "
            f"{_money(employee.base_salary)} mensuales."
        )
        y = _draw_paragraph(c, x0, y, salary_text, main_w, size=10.5, leading=15.5)
        y -= 18

    status_text = (
        "El(la) colaborador(a) se encuentra activo(a) en la compañía a la fecha de expedición de este certificado."
        if employee.status == Employee.Status.ACTIVE
        else f"El estado actual del(de la) colaborador(a) en la compañía es: {employee.get_status_display()}."
    )
    y = _draw_paragraph(c, x0, y, status_text, main_w, size=10.5, leading=15.5)
    y -= 24

    y = _draw_summary_grid(c, x0, y, main_w, employee)
    y -= 30

    closing = (
        "Este certificado se expide a solicitud del(de la) interesado(a) para los fines que estime convenientes, "
        "a los datos consignados en los registros de Recursos Humanos de la compañía."
    )
    y = _draw_paragraph(c, x0, y, closing, main_w, size=9.5, leading=14, color=MUTED)
    y -= 26

    _text(c, x0, y, f"Expedido en Colombia, {_date(today)}.", size=9.5, color=TEXT)

    signer_name = _name(issued_by) if issued_by else "Recursos Humanos"
    role_label = issued_by.position.name if issued_by and issued_by.position_id else "Recursos Humanos"
    signature_file = getattr(issued_by, "signature", None) if issued_by else None
    signature_w = 240
    image_h = 92
    signature_h = signature_block_height(image_h)

    # La firma se ancla a una posicion fija cerca del pie de pagina, en vez de
    # seguir el flujo del texto, para que siempre quede dentro del marco decorativo.
    footer_y = bottom_y - 6
    signature_top = footer_y + 22 + signature_h
    if signature_top > y - 26:
        signature_top = y - 26

    draw_signature_block(
        c,
        x0 + (main_w - signature_w) / 2,
        signature_top,
        signature_w,
        signature_file=signature_file,
        signer_name=signer_name,
        role_label=role_label,
        decided_at=timezone.now(),
        image_h=image_h,
    )

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawCentredString(page_w / 2, footer_y, "Documento generado digitalmente por el sistema de gestión de Recursos Humanos.")

    c.save()
    buffer.seek(0)
    return buffer


def get_default_hr_signer() -> Employee | None:
    """Firmante por defecto para certificados que descarga el propio empleado:
    el primer Admin o RRHH con firma cargada."""
    return (
        Employee.objects.filter(user__role__code__in=("ADMIN", "RRHH"))
        .exclude(signature="")
        .order_by("user__role__code")
        .first()
    )
