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

# ── Paleta ─────────────────────────────────────────────────────────────────────
NAVY       = HexColor("#1B3A6B")   # azul marino — acento principal
STEEL      = HexColor("#2E6DA4")   # azul acero  — elementos secundarios
LIGHT_BLUE = HexColor("#EAF1F8")   # franja de fondo en encabezado
TEXT       = HexColor("#1A1A1A")   # cuerpo del texto
MUTED      = HexColor("#5D6D7E")   # metadatos y pies
RULE       = HexColor("#C8D8E8")   # separadores finos

FONT      = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


# ── Utilidades de dato ─────────────────────────────────────────────────────────
def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _name(employee):
    return (
        f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip()
        or _safe(employee.employee_code)
    )


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


# ── Imágenes ───────────────────────────────────────────────────────────────────
def _draw_logo(c, x, y, size=44):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        c.drawImage(
            ImageReader(LOGO_PATH), x, y - size,
            width=size, height=size,
            preserveAspectRatio=True, mask="auto",
        )
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


# ── Encabezado membretado ──────────────────────────────────────────────────────
def _draw_header(c, page_w, page_h, x0, x1):
    """
    Franja azul claro a todo ancho + logo a la izquierda + datos empresa a la derecha.
    Retorna la coordenada y donde termina el encabezado.
    """
    band_h = 72
    band_y = page_h - band_h

    # franja de fondo
    c.setFillColor(LIGHT_BLUE)
    c.rect(0, band_y, page_w, band_h, stroke=0, fill=1)

    # borde inferior de la franja (acento marino)
    c.setStrokeColor(NAVY)
    c.setLineWidth(2.5)
    c.line(0, band_y, page_w, band_y)

    # logo
    _draw_logo(c, x0, page_h - 14, size=44)

    # datos de empresa
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 11.5)
    c.drawRightString(x1, page_h - 26, COMPANY_NAME)
    c.setFont(FONT, 8.5)
    c.setFillColor(STEEL)
    c.drawRightString(x1, page_h - 39, "Gestión de Talento Humano  ·  Recursos Humanos")

    return band_y - 28  # margen bajo la franja


# ── Título del documento ───────────────────────────────────────────────────────
def _draw_title(c, cx, y):
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 15)
    c.drawCentredString(cx, y, "CERTIFICADO LABORAL")

    # línea decorativa bajo el título
    c.setStrokeColor(STEEL)
    c.setLineWidth(1.2)
    c.line(cx - 90, y - 8, cx + 90, y - 8)

    return y - 28


# ── Párrafo con negritas ───────────────────────────────────────────────────────
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


def _draw_rich_paragraph(c, x, y, parts, max_width, size=10.8, leading=17, align="justify"):
    tokens = _parse_runs(parts)

    lines: list[list[tuple[str, bool]]] = []
    current_line: list[tuple[str, bool]] = []
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
        natural_w = sum(
            stringWidth(w, FONT_BOLD if b else FONT, size) for w, b in line
        )
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


# ── Pie de firma elegante ──────────────────────────────────────────────────────
def _draw_signature_block(c, x0, y_anchor, signer_name, signer_role, signer_phone, signature_file):
    """
    Bloque de firma sin líneas crudas:
    imagen → franja punteada sutil → nombre en mayúsculas → cargo → teléfono.
    El punteado (········) es solo decorativo y ocupa el espacio visual de una línea.
    """
    _draw_signature_image(c, x0, y_anchor + 10, 200, 58, signature_file)

    # franja punteada decorativa (reemplaza la línea recta)
    dot_y = y_anchor + 6
    dot_x = x0
    dot_end = x0 + 230
    c.setFillColor(RULE)
    step = 5
    while dot_x < dot_end:
        c.rect(dot_x, dot_y, 2.5, 1.2, stroke=0, fill=1)
        dot_x += step

    # nombre
    c.setFont(FONT_BOLD, 10.5)
    c.setFillColor(NAVY)
    c.drawString(x0, y_anchor - 10, signer_name.upper())

    # cargo
    c.setFont(FONT_BOLD, 9)
    c.setFillColor(STEEL)
    c.drawString(x0, y_anchor - 23, signer_role.upper())

    # teléfono (opcional)
    if signer_phone:
        c.setFont(FONT, 8.5)
        c.setFillColor(MUTED)
        c.drawString(x0, y_anchor - 36, f"Cel: {signer_phone}")


# ── Pie de página ──────────────────────────────────────────────────────────────
def _draw_footer(c, x0, x1):
    y = 40
    c.setStrokeColor(RULE)
    c.setLineWidth(0.8)
    c.line(x0, y + 12, x1, y + 12)
    c.setFont(FONT, 7.5)
    c.setFillColor(MUTED)
    today_str = f"{timezone.localdate():%d/%m/%Y}"
    c.drawString(x0, y, f"Expedido el {today_str}  ·  PRODUCTOS JUHNIOS ROLD SAS  ·  Uso interno y externo autorizado")
    c.drawRightString(x1, y, "1 / 1")


# ── Punto de entrada ───────────────────────────────────────────────────────────
def render_employee_certificate_pdf(
    employee: Employee,
    issued_by: Employee | None = None,
    include_salary: bool = True,
    signature_file=None,
):
    """
    Genera el certificado laboral en PDF con diseño membretado profesional.

    signature_file: archivo de firma prioritario sobre el de issued_by.
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Certificado Laboral — {_name(employee)}")

    page_w, page_h = letter
    x0, x1 = 72, page_w - 72
    main_w = x1 - x0
    cx = (x0 + x1) / 2

    # ── Encabezado ──────────────────────────────────────────────────────────
    y = _draw_header(c, page_w, page_h, x0, x1)

    # ── Título ──────────────────────────────────────────────────────────────
    y = _draw_title(c, cx, y)

    # ── Datos del firmante y empleado ────────────────────────────────────────
    signer_name     = _name(issued_by) if issued_by else "Recursos Humanos"
    signer_role     = (issued_by.position.name if issued_by and issued_by.position_id else "Recursos Humanos")
    signer_phone    = getattr(issued_by, "phone", None) if issued_by else None
    signer_doc      = _safe(issued_by.document_number) if issued_by else "-"
    doc_label       = _signer_document_label(issued_by)

    emp_doc_label   = employee.get_document_type_display() if employee.document_type else "C.I."
    treatment       = (
        "Sr."   if employee.gender == Employee.Gender.MALE   else
        "Sra."  if employee.gender == Employee.Gender.FEMALE else
        "Sr(a)."
    )
    position_name   = employee.position.name.upper() if employee.position_id else "COLABORADOR(A)"

    # ── Párrafo introductorio ─────────────────────────────────────────────────
    intro_parts = [
        ("Quien suscribe, ", False),
        (signer_name.upper() + ",", True),
        (f" con número de {doc_label} {signer_doc}, por medio de la presente, certifico que", False),
        (f" {treatment} ", False),
        (_name(employee).upper() + ",", True),
        (f" con {emp_doc_label} {_safe(employee.document_number)}, se desempeña en el cargo de", False),
        (f" {position_name} ", True),
        (f"en {COMPANY_NAME}, vinculado(a) desde el {_short_date(employee.hire_date)},", False),
        (
            " tiempo en el cual ha demostrado excelentes habilidades en el desempeño de sus funciones"
            " y un comportamiento acorde con los valores de la organización, convirtiéndose en un"
            " elemento valioso dentro de nuestro equipo de trabajo.",
            False,
        ),
    ]
    y = _draw_rich_paragraph(c, x0, y, intro_parts, main_w)
    y -= 18

    # ── Salario ────────────────────────────────────────────────────────────────
    if include_salary and employee.base_salary:
        salary_parts = [
            ("Devenga un salario ", False),
            (employee.get_salary_type_display().lower() + " de ", False),
            (_money(employee.base_salary), True),
            (" mensuales.", False),
        ]
        y = _draw_rich_paragraph(c, x0, y, salary_parts, main_w)
        y -= 18

    # ── Recomendación ──────────────────────────────────────────────────────────
    recommendation = (
        "Por lo anterior, no tengo ningún inconveniente en recomendarlo(a) para cualquier aspecto"
        " que esté solicitando, ya que estoy seguro(a) de que lo hará con la misma excelencia que"
        " lo ha caracterizado durante su permanencia en la empresa."
    )
    y = _draw_rich_paragraph(c, x0, y, [(recommendation, False)], main_w)
    y -= 18

    # ── Nota de uso ────────────────────────────────────────────────────────────
    usage = "El(la) interesado(a) puede hacer uso de este certificado como a bien tuviere."
    y = _draw_rich_paragraph(c, x0, y, [(usage, False)], main_w)
    y -= 28

    # ── Cierre ─────────────────────────────────────────────────────────────────
    c.setFont(FONT, 10.8)
    c.setFillColor(TEXT)
    c.drawString(x0, y, "Atentamente,")
    y -= 18
    c.setFont(FONT, 10)
    c.setFillColor(MUTED)
    c.drawString(x0, y, f"Expedido el {_date_long(timezone.localdate())}.")

    # ── Bloque de firma ────────────────────────────────────────────────────────
    sig_y = max(y - 90, 100)
    file_to_draw = signature_file or (getattr(issued_by, "signature", None) if issued_by else None)
    _draw_signature_block(c, x0, sig_y, signer_name, signer_role, signer_phone, file_to_draw)

    # ── Pie de página ──────────────────────────────────────────────────────────
    _draw_footer(c, x0, x1)

    c.save()
    buffer.seek(0)
    return buffer


def get_default_hr_signer() -> Employee | None:
    """Firmante por defecto: primer Admin o RRHH con firma cargada."""
    return (
        Employee.objects.filter(user__role__code__in=("ADMIN", "RRHH"))
        .exclude(signature="")
        .order_by("user__role__code")
        .first()
    )
