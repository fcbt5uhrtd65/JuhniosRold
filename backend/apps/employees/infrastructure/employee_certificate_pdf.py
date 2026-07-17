import io
import os

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from .models import Employee

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
LOGO_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "finance", "infrastructure", "assets", "logo.jpeg")
)
TEXT = HexColor("#000000")
MUTED = HexColor("#444444")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _name(employee):
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _short_date(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _date_long(value):
    return f"{value:%d de %B de %Y}" if value else "-"


def _money(value):
    if value in (None, ""):
        return "-"
    return f"${value:,.0f} COP"


def _signer_document_label(issued_by):
    if issued_by and issued_by.document_type:
        return issued_by.get_document_type_display().lower()
    return "documento"


def _draw_logo(c, x, y, size=40):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        c.drawImage(ImageReader(LOGO_PATH), x, y - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except Exception:
        return 0
    return size


def _draw_header(c, x0, x1, y):
    """Encabezado con logo a la izquierda y datos de la empresa alineados a la derecha,
    igual al patron de una carta membretada clasica."""
    logo_size = _draw_logo(c, x0, y, 40)

    c.setFillColor(TEXT)
    c.setFont(FONT_BOLD, 12)
    c.drawRightString(x1, y - 12, COMPANY_NAME)
    c.setFont(FONT, 9)
    c.drawRightString(x1, y - 25, "Recursos Humanos")

    return y - max(logo_size, 30) - 20


def _parse_runs(parts):
    """parts es una lista de (texto, bold). Devuelve tokens (palabra, bold) preservando
    los espacios entre palabras para poder envolver el parrafo respetando negritas."""
    tokens = []
    for text, bold in parts:
        words = text.split(" ")
        for index, word in enumerate(words):
            if index > 0:
                tokens.append((" ", bold))
            if word:
                tokens.append((word, bold))
    return tokens


def _draw_rich_paragraph(c, x, y, parts, max_width, size=10.5, leading=16, align="justify"):
    """Dibuja un parrafo con tramos en negrita, envolviendo palabras al ancho maximo.
    parts: lista de tuplas (texto, bold: bool). Devuelve el nuevo y.
    """
    tokens = _parse_runs(parts)

    lines = []
    current_line = []
    current_width = 0.0
    for word, bold in tokens:
        if word == " ":
            word_width = stringWidth(" ", FONT, size)
        else:
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
    for line_index, line in enumerate(lines):
        line_y = y - line_index * leading
        is_last_line = line_index == len(lines) - 1
        words_only = [tok for tok in line if tok[0] != " "]
        natural_width = sum(
            stringWidth(word, FONT_BOLD if bold else FONT, size) for word, bold in line
        )

        if align == "justify" and not is_last_line and len(words_only) > 1:
            extra_space = max(max_width - natural_width, 0)
            gap_count = sum(1 for word, _ in line if word == " ")
            extra_per_gap = (extra_space / gap_count) if gap_count else 0
            cursor_x = x
            for word, bold in line:
                if word == " ":
                    cursor_x += stringWidth(" ", FONT, size) + extra_per_gap
                    continue
                c.setFont(FONT_BOLD if bold else FONT, size)
                c.drawString(cursor_x, line_y, word)
                cursor_x += stringWidth(word, FONT_BOLD if bold else FONT, size)
        else:
            cursor_x = x
            for word, bold in line:
                if word == " ":
                    cursor_x += stringWidth(" ", FONT, size)
                    continue
                c.setFont(FONT_BOLD if bold else FONT, size)
                c.drawString(cursor_x, line_y, word)
                cursor_x += stringWidth(word, FONT_BOLD if bold else FONT, size)

    return y - len(lines) * leading


def _draw_signature_image(c, x, y, max_w, max_h, signature_file):
    if not signature_file:
        return 0
    try:
        if not signature_file.storage.exists(signature_file.name):
            return 0
        with signature_file.open("rb") as file_obj:
            image = ImageReader(io.BytesIO(file_obj.read()))
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


def render_employee_certificate_pdf(employee: Employee, issued_by: Employee | None = None, include_salary: bool = True, signature_file=None):
    """Genera el certificado laboral en formato de carta formal (tipo carta clasica,
    sin cuadros ni marcos), con la firma de quien lo emite justo antes del cierre.

    signature_file: archivo de firma a usar para este certificado puntual (tiene
    prioridad); si no se pasa, se usa la firma guardada de issued_by.
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Certificado laboral - {_name(employee)}")

    page_w, page_h = letter
    x0, x1 = 72, page_w - 72
    main_w = x1 - x0
    y = page_h - 64

    y = _draw_header(c, x0, x1, y)
    y -= 24

    c.setFillColor(TEXT)
    c.setFont(FONT_BOLD, 15)
    c.drawCentredString((x0 + x1) / 2, y, "CERTIFICADO LABORAL")
    y -= 36

    signer_name = _name(issued_by) if issued_by else "Recursos Humanos"
    signer_role = issued_by.position.name if issued_by and issued_by.position_id else "Recursos Humanos"
    signer_document = _safe(issued_by.document_number) if issued_by else "-"

    employee_document_label = employee.get_document_type_display() if employee.document_type else "C.I."
    treatment = "Sr." if employee.gender == Employee.Gender.MALE else "Sra." if employee.gender == Employee.Gender.FEMALE else "Sr(a)."

    intro_parts = [
        ("Quien suscribe, ", False),
        (signer_name.upper() + ",", True),
        (f" con número de {_signer_document_label(issued_by)} {signer_document}, por medio de la presente, certifico que", False),
        (f" el/la {treatment} ", False),
        (_name(employee).upper() + ",", True),
        (f" con {employee_document_label} {_safe(employee.document_number)}, se desempeña como", False),
        (f" {employee.position.name.upper() if employee.position_id else 'COLABORADOR(A)'} ", True),
        (f"en {COMPANY_NAME}, desde el {_short_date(employee.hire_date)}", False),
        (
            f", tiempo en el cual ha demostrado excelentes habilidades en el desempeño de sus funciones y "
            f"un comportamiento acorde con los valores de la organización, convirtiéndose en un elemento valioso "
            f"dentro de nuestro equipo de trabajo.",
            False,
        ),
    ]
    y = _draw_rich_paragraph(c, x0, y, intro_parts, main_w, size=10.8, leading=17)
    y -= 20

    if include_salary and employee.base_salary:
        salary_parts = [
            ("Devenga un salario ", False),
            (employee.get_salary_type_display().lower() + " de ", False),
            (_money(employee.base_salary), True),
            (" mensuales.", False),
        ]
        y = _draw_rich_paragraph(c, x0, y, salary_parts, main_w, size=10.8, leading=17)
        y -= 20

    recommendation = (
        "Por lo anterior, no tengo ningún inconveniente en recomendarlo(a) para cualquier aspecto que esté "
        "solicitando, ya que estoy segura de que lo hará con la misma excelencia que lo ha caracterizado."
    )
    y = _draw_rich_paragraph(c, x0, y, [(recommendation, False)], main_w, size=10.8, leading=17)
    y -= 20

    usage_note = "El(la) interesado(a) puede hacer uso de este certificado como a bien tuviere."
    y = _draw_rich_paragraph(c, x0, y, [(usage_note, False)], main_w, size=10.8, leading=17)
    y -= 24

    c.setFont(FONT, 10.8)
    c.setFillColor(TEXT)
    today = timezone.localdate()
    c.drawString(x0, y, "Atentamente,")
    y -= 20
    c.drawString(x0, y, f"Expedido el {_date_long(today)}.")

    # Firma anclada al pie de pagina, sin depender del largo del texto anterior.
    signature_zone_h = 140
    signature_y = max(y - signature_zone_h, 130)

    file_to_draw = signature_file or (getattr(issued_by, "signature", None) if issued_by else None)
    _draw_signature_image(c, x0, signature_y + 34, 200, 60, file_to_draw)

    line_y = signature_y + 28
    c.setStrokeColor(MUTED)
    c.setLineWidth(0.7)
    c.line(x0, line_y, x0 + 220, line_y)

    c.setFont(FONT_BOLD, 10.5)
    c.setFillColor(TEXT)
    c.drawString(x0, line_y - 15, signer_name.upper())
    c.setFont(FONT_BOLD, 9.5)
    c.drawString(x0, line_y - 28, signer_role.upper())
    if issued_by and issued_by.phone:
        c.setFont(FONT, 8.5)
        c.setFillColor(MUTED)
        c.drawString(x0, line_y - 41, f"Cel: {issued_by.phone}")

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
