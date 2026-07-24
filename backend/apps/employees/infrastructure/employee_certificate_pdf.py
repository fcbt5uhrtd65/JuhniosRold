import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from shared.infrastructure.pdf_letterhead import (
    draw_letterhead_footer,
    draw_letterhead_header,
    draw_signature_line_block,
)

from .models import Employee

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"

# ── Paleta ─────────────────────────────────────────────────────────────────────
TEXT       = HexColor("#1A1A1A")   # cuerpo del texto
MUTED      = HexColor("#5D6D7E")   # metadatos y pies

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


# ── Encabezado membretado ──────────────────────────────────────────────────────
def _draw_header(c, page_w, page_h, x0, x1):
    """Membrete oficial (franja superior); el nombre de la empresa ya queda comunicado
    por el membrete, así que aquí solo se ubica el subtítulo de área, con aire
    suficiente respecto a la franja para que no se vea pegado.
    Retorna la coordenada y donde termina el encabezado."""
    y = draw_letterhead_header(c, page_w, page_h, x0, x1)

    c.setFont(FONT, 8.5)
    c.setFillColor(MUTED)
    c.drawRightString(x1, y, "Gestión de Talento Humano  ·  Recursos Humanos")

    return y - 40


# ── Título del documento ───────────────────────────────────────────────────────
def _draw_title(c, cx, y):
    c.setFillColor(TEXT)
    c.setFont(FONT_BOLD, 17)
    c.drawCentredString(cx, y, "CERTIFICADO LABORAL")

    return y - 40


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


# ── Pie de firma ───────────────────────────────────────────────────────────────
def _draw_signature_block(c, x0, w, line_y, signer_name, signer_role, signature_file):
    """Firma pegada directamente a la línea, tamaño fijo y moderado (helper compartido)."""
    draw_signature_line_block(
        c, x0, line_y, w, signer_name, signer_role, signature_file,
        font=(FONT, FONT_BOLD), navy=TEXT, muted=MUTED,
    )


# ── Pie de página ──────────────────────────────────────────────────────────────
def _draw_footer(c, page_w, x0, x1):
    footer_h = draw_letterhead_footer(c, page_w, x0, x1)
    c.setFont(FONT, 7.2)
    c.setFillColor(MUTED)
    c.drawCentredString(page_w / 2, footer_h + 12, f"Documento oficial · {COMPANY_NAME} · Certificado válido con firma digital registrada.")
    return footer_h


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
    department_name = employee.department.name if employee.department_id else None
    contract_label   = employee.get_contract_type_display().lower() if employee.contract_type else None

    # ── Párrafo introductorio ─────────────────────────────────────────────────
    intro_parts = [
        ("Quien suscribe, ", False),
        (signer_name.upper() + ",", True),
        (f" con número de {doc_label} {signer_doc}, por medio de la presente, certifico que", False),
        (f" {treatment} ", False),
        (_name(employee).upper() + ",", True),
        (f" con {emp_doc_label} {_safe(employee.document_number)}, se desempeña en el cargo de", False),
        (f" {position_name} ", True),
    ]
    if department_name:
        intro_parts += [
            (", adscrito(a) al área de", False),
            (f" {department_name.upper()}", True),
        ]
    intro_parts += [
        (f", en {COMPANY_NAME}, vinculado(a) desde el {_short_date(employee.hire_date)}", False),
    ]
    if contract_label:
        intro_parts += [
            (" mediante un contrato de tipo", False),
            (f" {contract_label}", True),
        ]
    intro_parts += [
        (
            ", tiempo en el cual ha demostrado excelentes habilidades en el desempeño de sus funciones"
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
        if employee.status == Employee.Status.ACTIVE:
            salary_parts += [(" A la fecha de expedición de este certificado, se encuentra activo(a) en la empresa.", False)]
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
    footer_min_y = 118
    sig_line_y = max(y - 55, footer_min_y)
    sig_w = 220
    sig_x = cx - sig_w / 2
    file_to_draw = signature_file or (getattr(issued_by, "signature", None) if issued_by else None)
    role_label = signer_role.upper() + (f"  ·  Cel: {signer_phone}" if signer_phone else "")
    _draw_signature_block(c, sig_x, sig_w, sig_line_y, signer_name, role_label, file_to_draw)

    # ── Pie de página ──────────────────────────────────────────────────────────
    _draw_footer(c, page_w, x0, x1)

    c.save()
    buffer.seek(0)
    return buffer


def get_default_hr_signer() -> Employee | None:
    """Firmante oficial: Administrador con firma registrada."""
    return (
        Employee.objects.filter(user__role__code="ADMIN")
        .exclude(signature="")
        .order_by("created_at")
        .first()
    )
