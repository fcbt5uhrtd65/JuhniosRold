import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from shared.infrastructure.pdf_letterhead import draw_letterhead_footer, draw_letterhead_header

TEXT = HexColor("#1a1a1a")
MUTED = HexColor("#5d6d7e")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _text(c, x, y, text, size=9, bold=False, color=TEXT, align="left"):
    c.setFillColor(color)
    c.setFont(FONT_BOLD if bold else FONT, size)
    if align == "center":
        c.drawCentredString(x, y, _safe(text, ""))
    elif align == "right":
        c.drawRightString(x, y, _safe(text, ""))
    else:
        c.drawString(x, y, _safe(text, ""))


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


def _draw_rich_paragraph(c, x, y, parts, max_width, size=9.5, leading=14):
    """Párrafo de texto corrido con tramos en negrita, justificado — mismo estilo
    narrativo usado en el certificado laboral y la constancia de solicitud."""
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

    for line_idx, line in enumerate(lines):
        line_y = y - line_idx * leading
        is_last = line_idx == len(lines) - 1
        natural_w = sum(stringWidth(w, FONT_BOLD if b else FONT, size) for w, b in line)
        gap_count = sum(1 for w, _ in line if w == " ")
        extra_per_gap = (max(max_width - natural_w, 0) / gap_count) if (not is_last and gap_count) else 0
        cursor_x = x
        for word, bold in line:
            if word == " ":
                cursor_x += stringWidth(" ", FONT, size) + extra_per_gap
                continue
            c.setFillColor(TEXT)
            c.setFont(FONT_BOLD if bold else FONT, size)
            c.drawString(cursor_x, line_y, word)
            cursor_x += stringWidth(word, FONT_BOLD if bold else FONT, size)

    return y - len(lines) * leading


def _employee_email(employee):
    user = getattr(employee, "user", None)
    return _safe(getattr(user, "email", None) or employee.email)


def render_employee_access_pdf(employee, issued_by=None):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Credenciales de acceso — {_name(employee)}")

    page_w, page_h = letter
    x0, x1 = 64, page_w - 64
    main_w = x1 - x0
    cx = page_w / 2

    y = draw_letterhead_header(c, page_w, page_h, x0, x1)
    footer_h = draw_letterhead_footer(c, page_w, x0, x1)
    bottom_limit = footer_h + 26

    _text(c, x1, y, "Gestión de Talento Humano", size=8.5, color=MUTED, align="right")
    y -= 40

    _text(c, cx, y, "CREDENCIALES DE ACCESO", size=15, bold=True, color=TEXT, align="center")
    y -= 15
    _text(c, cx, y, "Documento confidencial para entrega al empleado", size=8.5, color=MUTED, align="center")
    y -= 36

    position_name = employee.position.name if employee.position_id else "colaborador(a)"
    department_name = employee.department.name if employee.department_id else None

    intro_parts = [
        ("Se generan las credenciales de acceso al sistema para", False),
        (f" {_name(employee)}, ", True),
        (f"identificado(a) con el código de empleado", False),
        (f" {_safe(employee.employee_code)}, ", True),
        (f"quien se desempeña como", False),
        (f" {position_name}", True),
    ]
    if department_name:
        intro_parts += [
            (", en el área de", False),
            (f" {department_name}", True),
        ]
    intro_parts += [(".", False)]
    y = _draw_rich_paragraph(c, x0, y, intro_parts, main_w)
    y -= 22

    access_parts = [
        ("El usuario para ingresar al sistema es el correo", False),
        (f" {_employee_email(employee)} ", True),
        ("y la clave asignada es", False),
        (f" {_safe(employee.access_password)}", True),
        (". Se recomienda iniciar sesión y verificar el acceso lo antes posible.", False),
    ]
    y = _draw_rich_paragraph(c, x0, y, access_parts, main_w)
    y -= 22

    confidential_parts = [
        (
            "Esta clave es de carácter confidencial y debe entregarse únicamente al empleado autorizado. "
            "Únicamente el Administrador y Recursos Humanos tienen la capacidad de consultarla o regenerarla. "
            "Se recomienda cambiarla si se sospecha que fue compartida indebidamente.",
            False,
        ),
    ]
    y = _draw_rich_paragraph(c, x0, y, confidential_parts, main_w, size=8.8, leading=13)
    y -= 8

    issued_at = timezone.localtime(timezone.now())
    issued_name = _safe(getattr(issued_by, "email", None) or getattr(issued_by, "first_name", None), "Admin/RRHH")
    updated_at = (
        timezone.localtime(employee.access_password_updated_at).strftime("%d/%m/%Y %I:%M %p")
        if employee.access_password_updated_at
        else "-"
    )

    footer_y = max(y - 20, bottom_limit + 30)
    _text(c, x0, footer_y, f"Generado el {issued_at:%d/%m/%Y a las %I:%M %p} por {issued_name}.", size=7.8, color=MUTED)
    _text(c, x0, footer_y - 12, f"Última actualización de clave: {updated_at}.", size=7.8, color=MUTED)

    c.save()
    buffer.seek(0)
    return buffer
