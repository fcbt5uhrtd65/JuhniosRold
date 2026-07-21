import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from shared.infrastructure.pdf_letterhead import draw_letterhead_footer, draw_letterhead_header

TEXT = HexColor("#111827")
MUTED = HexColor("#6b7280")
LINE = HexColor("#d1d5db")
BRAND = HexColor("#2a4038")
SOFT = HexColor("#f3f7f5")
WARNING_BG = HexColor("#fff7ed")
WARNING = HexColor("#9a3412")
WHITE = HexColor("#ffffff")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _fit(text, max_width, font_name=FONT, font_size=10):
    text = _safe(text, "")
    if stringWidth(text, font_name, font_size) <= max_width:
        return text
    suffix = "..."
    while text and stringWidth(text + suffix, font_name, font_size) > max_width:
        text = text[:-1]
    return text + suffix if text else suffix


def _text(c, x, y, text, size=10, bold=False, color=TEXT, align="left"):
    c.setFillColor(color)
    c.setFont(FONT_BOLD if bold else FONT, size)
    if align == "center":
        c.drawCentredString(x, y, _safe(text, ""))
    elif align == "right":
        c.drawRightString(x, y, _safe(text, ""))
    else:
        c.drawString(x, y, _safe(text, ""))


def _card(c, x, y, w, h, fill=WHITE, stroke=LINE):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y - h, w, h, 8, stroke=1, fill=1)


def _field(c, x, y, label, value, width):
    _text(c, x, y, label.upper(), size=7.5, bold=True, color=MUTED)
    _text(c, x, y - 15, _fit(value, width, FONT_BOLD, 11), size=11, bold=True, color=TEXT)


def _employee_email(employee):
    user = getattr(employee, "user", None)
    return _safe(getattr(user, "email", None) or employee.email)


def render_employee_access_pdf(employee, issued_by=None):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 54, page_w - 54
    content_w = x1 - x0
    cx = page_w / 2

    y = draw_letterhead_header(c, page_w, page_h, x0, x1)
    draw_letterhead_footer(c, page_w, x0, x1)

    _text(c, x1, y, "Gestion de Talento Humano", size=8.5, color=MUTED, align="right")
    y -= 34

    _text(c, cx, y, "CREDENCIALES DE ACCESO", size=18, bold=True, color=BRAND, align="center")
    y -= 18
    _text(c, cx, y, "Documento confidencial para entrega al empleado", size=9, color=MUTED, align="center")
    y -= 34

    _card(c, x0, y, content_w, 92, fill=SOFT)
    _field(c, x0 + 18, y - 22, "Empleado", _name(employee), content_w * 0.52)
    _field(c, x0 + 18, y - 58, "Codigo", employee.employee_code, 120)
    _field(c, x0 + 155, y - 58, "Cargo", employee.position.name if employee.position_id else "-", 160)
    _field(c, x0 + 330, y - 58, "Area", employee.department.name if employee.department_id else "-", 150)
    y -= 116

    _card(c, x0, y, content_w, 132)
    _text(c, x0 + 18, y - 24, "Acceso al sistema", size=12, bold=True, color=BRAND)
    _field(c, x0 + 18, y - 54, "Usuario", _employee_email(employee), content_w - 36)
    _field(c, x0 + 18, y - 94, "Clave", employee.access_password, content_w - 36)
    y -= 156

    _card(c, x0, y, content_w, 76, fill=WARNING_BG, stroke=HexColor("#fed7aa"))
    _text(c, x0 + 18, y - 24, "Informacion confidencial", size=11, bold=True, color=WARNING)
    _text(
        c,
        x0 + 18,
        y - 43,
        "Esta clave debe entregarse solo al empleado autorizado. Admin y RRHH pueden verla y regenerarla.",
        size=8.5,
        color=WARNING,
    )
    _text(c, x0 + 18, y - 58, "Recomendacion: cambiar la clave si se sospecha que fue compartida indebidamente.", size=8.5, color=WARNING)
    y -= 108

    issued_at = timezone.localtime(timezone.now())
    issued_name = _safe(getattr(issued_by, "email", None) or getattr(issued_by, "first_name", None), "Admin/RRHH")
    updated_at = timezone.localtime(employee.access_password_updated_at).strftime("%d/%m/%Y %I:%M %p") if employee.access_password_updated_at else "-"

    _text(c, x0, y, f"Generado: {issued_at:%d/%m/%Y %I:%M %p}", size=8, color=MUTED)
    _text(c, x0, y - 14, f"Generado por: {issued_name}", size=8, color=MUTED)
    _text(c, x0, y - 28, f"Ultima actualizacion de clave: {updated_at}", size=8, color=MUTED)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
