import io
import re
from datetime import datetime
from pathlib import Path

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter

from shared.infrastructure.pdf_letterhead import (
    draw_letterhead_footer,
    draw_letterhead_header,
    draw_signature_line_block,
    format_datetime_co,
    format_time_co,
)

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"

TEXT = HexColor("#1a1a1a")
MUTED = HexColor("#5d6d7e")
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


_time_label = format_time_co
_datetime_label = format_datetime_co


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


def _overtime_shift_parts(vacation):
    shifts = list(getattr(vacation, "overtime_shifts").all())
    if not shifts:
        return []

    parts = [(" Los turnos registrados fueron:", False)]
    for index, shift in enumerate(shifts):
        separator = " " if index == 0 else "; "
        parts.append((separator, False))
        parts.append((
            f"{_date_label(shift.date)} de {_time_label(shift.start_time)} a {_time_label(shift.end_time)} "
            f"({_calculate_shift_hours_label(shift)})",
            True,
        ))
    parts += [
        (", para un total de", False),
        (f" {_calculate_hours_label(vacation)}.", True),
    ]
    return parts


def _calculate_shift_hours_label(shift):
    if shift.hours_count not in (None, ""):
        value = float(shift.hours_count)
        hours = int(value)
        minutes = round((value - hours) * 60)
        return f"{hours} h {minutes} min" if minutes else f"{hours} h"
    if shift.start_time and shift.end_time:
        start = datetime.combine(shift.date, shift.start_time)
        end = datetime.combine(shift.date, shift.end_time)
        if end > start:
            minutes = int((end - start).total_seconds() // 60)
            hours, remainder = divmod(minutes, 60)
            return f"{hours} h {remainder} min" if remainder else f"{hours} h"
    return "-"


def _is_overtime(vacation):
    return getattr(vacation, "request_type", "") == "OVERTIME"


def _is_loan(vacation):
    return getattr(vacation, "request_type", "") == "LOAN"


def _money_label(value):
    if value in (None, ""):
        return "-"
    return f"${float(value):,.0f} COP"


def _loan_frequency_label(vacation):
    return _safe(vacation.get_loan_frequency_display()) if vacation.loan_frequency else "-"


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


def _wrap_lines(text, max_width, font_name=FONT, font_size=9):
    text = _safe(text, "")
    words = text.split()
    lines = []
    current = ""
    for word in words:
        if stringWidth(word, font_name, font_size) > max_width:
            if current:
                lines.append(current)
                current = ""
            pieces = []
            piece = ""
            for char in word:
                candidate = f"{piece}{char}"
                if not piece or stringWidth(candidate, font_name, font_size) <= max_width:
                    piece = candidate
                else:
                    pieces.append(piece)
                    piece = char
            if piece:
                pieces.append(piece)
            if len(pieces) > 1:
                lines.extend(pieces[:-1])
            current = pieces[-1] if pieces else ""
            continue
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


def _draw_key_value_cell(c, x, y, label, value, cell_width, label_width=118):
    value_x = x + label_width
    value_width = max(cell_width - label_width - 8, 48)
    value_size = 9
    leading = 11.5

    _text(c, x, y, f"{label}:", size=8.6, bold=True, color=MUTED)
    lines = _wrap_lines(value, value_width, FONT, value_size)
    c.setFillColor(TEXT)
    c.setFont(FONT, value_size)
    for index, line in enumerate(lines):
        c.drawString(value_x, y - (index * leading), line)
    return max(leading, len(lines) * leading)


def _parse_runs(parts):
    tokens = []
    for text, bold in parts:
        tokens.extend((word, bold) for word in re.findall(r"\S+", _safe(text, "")))
    return tokens


def _draw_rich_paragraph(c, x, y, parts, max_width, size=10, leading=15, align="justify"):
    """Parrafo de texto corrido con tramos en negrita (mismo estilo que el certificado laboral)."""
    tokens = _parse_runs(parts)

    lines = []
    current_line = []
    current_width = 0.0
    for word, bold in tokens:
        word_width = stringWidth(word, FONT_BOLD if bold else FONT, size)
        space_width = stringWidth(" ", FONT, size) if current_line else 0
        if current_width + space_width + word_width > max_width and current_line:
            lines.append(current_line)
            current_line = []
            current_width = word_width
        else:
            current_width += space_width + word_width
        current_line.append((word, bold))
    if current_line:
        lines.append(current_line)

    c.setFillColor(TEXT)
    for line_idx, line in enumerate(lines):
        line_y = y - line_idx * leading
        is_last = line_idx == len(lines) - 1
        gap_count = max(len(line) - 1, 0)
        natural_w = sum(stringWidth(w, FONT_BOLD if b else FONT, size) for w, b in line)
        natural_w += gap_count * stringWidth(" ", FONT, size)
        extra_per_gap = (
            (max(max_width - natural_w, 0) / gap_count)
            if (align == "justify" and not is_last and gap_count)
            else 0
        )
        cursor_x = x
        for word_idx, (word, bold) in enumerate(line):
            if word_idx > 0:
                cursor_x += stringWidth(" ", FONT, size) + extra_per_gap
            c.setFont(FONT_BOLD if bold else FONT, size)
            c.drawString(cursor_x, line_y, word)
            cursor_x += stringWidth(word, FONT_BOLD if bold else FONT, size)

    return y - len(lines) * leading


# ── Encabezado ─────────────────────────────────────────────────────────────────
def _draw_letterhead(c, page_w, page_h, x0, x1):
    """Franja del membrete + una sola línea de metadatos del documento (área y número
    de solicitud a la izquierda, fecha de generación a la derecha), ya con aire
    respecto a la franja. Una sola línea, bien alineada, sin trazos divisorios."""
    return draw_letterhead_header(c, page_w, page_h, x0, x1)


def _draw_title(c, x0, x1, cx, y, vacation, request_number):
    _text(c, x0, y, f"Gestión de Talento Humano  ·  {request_number}", size=8.5, bold=True, color=MUTED)
    now = timezone.now()
    _text(c, x1, y, f"Generado el {now:%d/%m/%Y} a las {_time_label(now)}", size=8, color=MUTED, align="right")
    y -= 38

    _text(c, cx, y, "CONSTANCIA DE SOLICITUD", size=17, bold=True, color=TEXT, align="center")
    y -= 18
    status_color = _status_color(vacation.status)
    _text(c, cx, y, vacation.get_status_display().upper(), size=9.5, bold=True, color=status_color, align="center")

    return y - 36


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
        (f"en el área de {hire_area}, sede {hire_branch}, fue registrada el {vacation.created_at:%d/%m/%Y} a las {_time_label(vacation.created_at)} y actualmente se encuentra en estado", False),
        (f" {vacation.get_status_display().upper()}.", True),
    ]
    y = _draw_rich_paragraph(c, x0, y, intro_parts, w, size=10, leading=15)
    y -= 14

    if _is_loan(vacation):
        return _draw_loan_details(c, x0, x1, y, vacation, employee)

    period_parts = [
        ("El periodo solicitado comprende desde el", False),
        (f" {_date_label(vacation.start_date)} ", True),
        ("hasta el", False),
        (f" {_date_label(vacation.end_date)}.", True),
    ]
    if _is_overtime(vacation):
        period_parts += _overtime_shift_parts(vacation) or [
            (" El horario registrado va de", False),
            (f" {_time_label(vacation.start_time)} ", True),
            ("a", False),
            (f" {_time_label(vacation.end_time)}, ", True),
            ("para un total de", False),
            (f" {_calculate_hours_label(vacation)}.", True),
        ]
    elif not vacation.is_full_day and vacation.start_time:
        if vacation.end_time:
            period_parts += [
                (" El horario registrado va de", False),
                (f" {_time_label(vacation.start_time)} ", True),
                ("a", False),
                (f" {_time_label(vacation.end_time)}, ", True),
                ("para un total de", False),
                (f" {_calculate_hours_label(vacation)}.", True),
            ]
        else:
            period_parts += [
                (" El horario registrado inicia a las", False),
                (f" {_time_label(vacation.start_time)} ", True),
                ("hasta el final de la jornada.", False),
            ]
    y = _draw_rich_paragraph(c, x0, y, period_parts, w, size=10, leading=15)
    y -= 14

    reason = vacation.reason or vacation.description or "No se registró un motivo adicional."
    reason_parts = [("Motivo o descripción registrada por el(la) solicitante: ", True), (f"“{reason}”", False)]
    y = _draw_rich_paragraph(c, x0, y, reason_parts, w, size=10, leading=15, align="left")
    y -= 18

    return y


# ── Bloque exclusivo de solicitudes de tipo PRÉSTAMO ────────────────────────────
def _draw_loan_details(c, x0, x1, y, vacation, employee):
    w = x1 - x0

    rows = [
        ("Ciudad", vacation.loan_city or "-"),
        ("Fecha de la solicitud", _date_label(vacation.start_date)),
        ("Cargo", vacation.loan_position or "-"),
        ("Nombre del solicitante", vacation.loan_requester_name or _employee_name(employee)),
        ("Cédula", vacation.loan_requester_document or "-"),
        ("Concepto", vacation.loan_concept or "-"),
        ("Monto solicitado", _money_label(vacation.loan_amount)),
        ("Forma de pago", _loan_frequency_label(vacation)),
        ("Número de cuotas", str(vacation.loan_installments_count) if vacation.loan_installments_count else "-"),
        ("Número de egreso", vacation.loan_expense_number or "-"),
    ]

    if vacation.loan_approved_amount is not None and vacation.loan_amount is not None and vacation.loan_approved_amount != vacation.loan_amount:
        rows.append(("Monto aprobado", f"{_money_label(vacation.loan_approved_amount)} (aprobación parcial)"))
    elif vacation.loan_approved_amount is not None and vacation.status == vacation.Status.APPROVED:
        rows.append(("Monto aprobado", _money_label(vacation.loan_approved_amount)))

    _text(c, x0, y, "Datos del préstamo", size=10.5, bold=True, color=TEXT)
    y -= 20
    col_w = w / 2
    for row_start in range(0, len(rows), 2):
        row_height = 0
        for col, (label, value) in enumerate(rows[row_start:row_start + 2]):
            col_x = x0 + col * col_w
            row_height = max(row_height, _draw_key_value_cell(c, col_x, y, label, value, col_w))
        y -= row_height + 5
    y -= 15

    frequency_label = _loan_frequency_label(vacation).lower()
    installments = vacation.loan_installments_count or "-"
    authorization_parts = [
        ("Autorización de descuento:", True),
        (" recibí de la empresa", False),
        (f" {COMPANY_NAME}, ", True),
        ("identificada en el encabezado de este documento, la suma arriba mencionada en calidad de préstamo. Autorizo expresamente para que se descuente de mi(s) salario(s), de forma", False),
        (f" {frequency_label}, ", True),
        (f"en un total de", False),
        (f" {installments} cuota(s), ", True),
        ("el valor correspondiente a este préstamo. Así mismo, autorizo se cobre de mi liquidación de prestaciones sociales, salarios e indemnización, el saldo pendiente de este préstamo si llegase a finalizar mi contrato de trabajo antes de cancelarlo en su totalidad.", False),
    ]
    y = _draw_rich_paragraph(c, x0, y, authorization_parts, w, size=9.6, leading=14, align="justify")
    y -= 18

    return y


def _is_manager_not_applicable(step):
    """El paso 'Jefe inmediato' nace ya resuelto (sin pedir firma) cuando ese
    jefe es el mismo Administrador: su firma real queda en el paso de
    Aprobación final, no tiene sentido pedirle una segunda firma por lo mismo."""
    return step.step == "MANAGER" and step.status == "CANCELLED" and not step.acted_at


def _hr_step_label(vacation):
    """El paso 'HR' del flujo lo ocupa Tesorería cuando la solicitud es de tipo
    Préstamo (RRHH solo puede consultarlos, no resolverlos)."""
    return "Tesorería" if _is_loan(vacation) else "RRHH"


def _approval_steps_data(vacation):
    steps = list(vacation.approval_steps.all())
    if _is_loan(vacation):
        steps = [step for step in steps if step.step in ("REQUESTER", "HR")]
    if steps:
        return [
            {
                "label": _hr_step_label(vacation) if step.step == "HR" else step.get_step_display(),
                "status": "No aplica" if _is_manager_not_applicable(step) else step.get_status_display(),
                "actor": _safe(getattr(step.user, "email", None)),
                "date": _datetime_label(step.acted_at),
                "detail": (
                    step.comment
                    if _is_manager_not_applicable(step)
                    else _safe(step.comment, "") or ("pendiente de gestión" if not step.acted_at else "acción registrada")
                ),
            }
            for step in steps[:4]
        ]
    decisions = [
        (_hr_step_label(vacation), vacation.hr_decision, vacation.hr_decided_by, vacation.hr_decided_at, vacation.hr_comment),
    ]
    if not _is_loan(vacation):
        decisions.insert(
            0,
            ("Administrador", vacation.admin_decision, vacation.admin_decided_by, vacation.admin_decided_at, vacation.admin_comment),
        )
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


def _draw_approval_narrative(c, x0, x1, y, vacation, compact=False):
    """Flujo de aprobación narrado como texto corrido, sin cuadros ni marcadores graficos.
    Cada paso queda claramente separado del siguiente, con su etiqueta de estado en la
    primera línea y los datos de trazabilidad (responsable, fecha, detalle) en líneas
    propias con sangría, para una lectura ordenada de arriba hacia abajo.

    ``compact`` reduce tamaños/espaciados cuando hay varios pasos, para garantizar
    que la constancia siempre quepa en una sola página."""
    w = x1 - x0
    _text(c, x0, y, "Trazabilidad del proceso de aprobación", size=10.5, bold=True, color=TEXT)
    y -= 20 if compact else 22

    steps = _approval_steps_data(vacation)
    if not steps:
        _text(c, x0, y, "Aún no se han registrado pasos de aprobación para esta solicitud.", size=9, color=MUTED)
        return y - 14

    label_size = 9 if compact else 9.5
    detail_size = 8.2 if compact else 8.6
    row_gap = 13 if compact else 15
    detail_leading = 10.5 if compact else 11.5
    block_gap = 12 if compact else 20
    indent = 12

    for index, step in enumerate(steps, start=1):
        status_color = _status_color(step["status"])
        # Etapa + estado en una linea (estado con color de estado, resto en texto normal)
        c.setFont(FONT_BOLD, label_size)
        c.setFillColor(TEXT)
        c.drawString(x0, y, f"{index}. {step['label']}:")
        label_w = stringWidth(f"{index}. {step['label']}: ", FONT_BOLD, label_size)
        c.setFont(FONT_BOLD, label_size)
        c.setFillColor(status_color)
        c.drawString(x0 + label_w, y, step["status"])
        y -= row_gap

        detail_text = f"Responsable: {step['actor']}  ·  Fecha: {step['date'] or 'sin fecha'}  ·  {step['detail']}"
        y = _draw_wrapped_text(c, x0 + indent, y, detail_text, w - indent, size=detail_size, leading=detail_leading, color=MUTED)
        y -= block_gap

    return y - 4


def _signing_steps(vacation):
    """Todos los pasos con una decisión efectivamente registrada (Jefe inmediato,
    RRHH y/o Administrador), para que el PDF muestre la firma de cada uno de los
    que participaron — no solo de quienes decidieron el resultado final."""
    decided_statuses = {"APPROVED", "REJECTED"}
    allowed_steps = {"HR"} if _is_loan(vacation) else {"MANAGER", "HR", "FINAL"}
    steps = [
        step
        for step in vacation.approval_steps.all()
        if step.step in allowed_steps and step.status in decided_statuses and step.user_id and step.acted_at
    ]
    order = {"MANAGER": 0, "HR": 1, "FINAL": 2}
    steps.sort(key=lambda step: order.get(step.step, 3))
    return steps[:3]


def _signature_columns(vacation):
    """Firmas a dibujar: primero la del solicitante (solo en préstamos), luego
    la de cada paso realmente decidido (Jefe inmediato, Tesorería/RRHH, Admin)."""
    steps = _signing_steps(vacation)
    requester_signature = _is_loan(vacation) and vacation.loan_requester_signature
    columns = []
    if requester_signature:
        columns.append((
            vacation.loan_requester_name or _employee_name(vacation.employee),
            "Solicitante",
            vacation.loan_requester_signature,
        ))
    for step in steps:
        employee = getattr(step.user, "employee_profile", None)
        signer_name = _employee_name(employee) if employee else _safe(getattr(step.user, "email", None))
        signature_file = getattr(step, "signature", None) or (getattr(employee, "signature", None) if employee else None)
        step_label = _hr_step_label(vacation) if step.step == "HR" else step.get_step_display()
        columns.append((signer_name, f"{step_label} · {step.get_status_display()}", signature_file))
    return columns


# Alto real necesario para el bloque de firmas, medido desde donde empieza el
# título "Firmas de aprobación" hasta el punto más bajo que efectivamente se
# dibuja (rol/cargo debajo de la línea de firma): 60px hasta la línea + ~28px
# de nombre/rol por debajo + margen de seguridad. Antes esta constante (130,
# luego reducida a 120 por error) subestimaba el alto real (~88-90px solo
# hasta el texto de rol) y dejaba que la firma invadiera el pie de página.
SIGNATURES_SECTION_HEIGHT = 60 + 28 + 40


def _draw_signatures_section(c, x0, x1, y, vacation):
    w = x1 - x0
    _text(c, x0, y, "Firmas de aprobación", size=10.5, bold=True, color=TEXT)
    y -= 60

    columns = _signature_columns(vacation)
    if not columns:
        return y - 14

    count = len(columns)
    gap = 20 if count >= 3 else 30
    col_w = (w - gap * (count - 1)) / count
    for index, (signer_name, role_label, signature_file) in enumerate(columns):
        col_x = x0 + index * (col_w + gap)
        draw_signature_line_block(
            c,
            col_x,
            y,
            col_w,
            signer_name,
            role_label,
            signature_file,
            font=(FONT, FONT_BOLD),
            navy=TEXT,
            muted=MUTED,
        )
    return y - 40


def _render_request_page(c, page_w, page_h, x0, x1, cx, vacation, employee, compact):
    """Dibuja el documento completo en el canvas dado y devuelve la coordenada y final
    (antes de las firmas), para poder medir si cupo en una sola página."""
    footer_h = draw_letterhead_footer(c, page_w, x0, x1)
    bottom_limit = footer_h + 26

    y = _draw_letterhead(c, page_w, page_h, x0, x1)
    y = _draw_title(c, x0, x1, cx, y, vacation, vacation.request_number or str(vacation.id))
    y = _draw_body(c, x0, x1, y, vacation, employee)
    y = _draw_approval_narrative(c, x0, x1, y, vacation, compact=compact)
    y -= 8

    fits_one_page = (y - SIGNATURES_SECTION_HEIGHT) >= bottom_limit
    return y, bottom_limit, fits_one_page


def _draw_footer_note(c, page_w, bottom_limit):
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.2)
    c.drawCentredString(page_w / 2, bottom_limit - 12, f"Documento oficial · {COMPANY_NAME} · Válido con firmas digitales registradas.")


def _read_support_document_bytes(support_document):
    if not support_document:
        return b""
    support_document.open("rb")
    try:
        return support_document.read()
    finally:
        support_document.close()


def _render_support_image_pdf(image_bytes, filename):
    page_w, page_h = letter
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    x0, x1 = 48, page_w - 48
    top = page_h - 46
    bottom = 46
    available_w = x1 - x0
    available_h = top - bottom - 28

    c.setFillColor(TEXT)
    c.setFont(FONT_BOLD, 12)
    c.drawString(x0, page_h - 30, "Soporte adjunto")
    c.setFillColor(MUTED)
    c.setFont(FONT, 8)
    c.drawString(x0, page_h - 42, _safe(filename, "Documento de soporte"))

    image = ImageReader(io.BytesIO(image_bytes))
    image_w, image_h = image.getSize()
    scale = min(available_w / image_w, available_h / image_h)
    draw_w = image_w * scale
    draw_h = image_h * scale
    draw_x = x0 + (available_w - draw_w) / 2
    draw_y = bottom + (available_h - draw_h) / 2
    c.drawImage(image, draw_x, draw_y, width=draw_w, height=draw_h, preserveAspectRatio=True, anchor="c")
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def _render_support_error_pdf(filename):
    page_w, page_h = letter
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    x0 = 64
    c.setFillColor(TEXT)
    c.setFont(FONT_BOLD, 12)
    c.drawString(x0, page_h - 72, "Soporte adjunto")
    c.setFillColor(DANGER)
    c.setFont(FONT, 9)
    c.drawString(x0, page_h - 92, f"No fue posible anexar el archivo: {_safe(filename)}")
    c.setFillColor(MUTED)
    c.drawString(x0, page_h - 108, "Descargue el soporte original desde el detalle de la solicitud.")
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def _append_support_document(base_pdf_buffer, vacation):
    support_document = getattr(vacation, "support_document", None)
    if not support_document:
        base_pdf_buffer.seek(0)
        return base_pdf_buffer

    filename = Path(support_document.name).name
    extension = Path(filename).suffix.lower()
    writer = PdfWriter()
    base_pdf_buffer.seek(0)
    for page in PdfReader(base_pdf_buffer).pages:
        writer.add_page(page)

    try:
        support_bytes = _read_support_document_bytes(support_document)
        if extension == ".pdf":
            for page in PdfReader(io.BytesIO(support_bytes)).pages:
                writer.add_page(page)
        elif extension in {".png", ".jpg", ".jpeg"}:
            image_pdf = _render_support_image_pdf(support_bytes, filename)
            for page in PdfReader(image_pdf).pages:
                writer.add_page(page)
        else:
            base_pdf_buffer.seek(0)
            return base_pdf_buffer
    except Exception:
        error_pdf = _render_support_error_pdf(filename)
        for page in PdfReader(error_pdf).pages:
            writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output


def render_request_pdf(vacation):
    page_w, page_h = letter
    x0, x1 = 64, page_w - 64
    cx = (x0 + x1) / 2
    employee = vacation.employee

    # Pasada de medición: se dibuja en un lienzo descartable para saber si el
    # contenido (con espaciado normal) cabe en una sola página. Si no cabe, se
    # usa espaciado compacto en la trazabilidad para garantizar una sola página.
    probe_buffer = io.BytesIO()
    probe_canvas = canvas.Canvas(probe_buffer, pagesize=letter)
    _, _, fits_normal = _render_request_page(probe_canvas, page_w, page_h, x0, x1, cx, vacation, employee, compact=False)
    compact = not fits_normal

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"Solicitud {vacation.request_number or vacation.id}")

    y, bottom_limit, fits_one_page = _render_request_page(c, page_w, page_h, x0, x1, cx, vacation, employee, compact=compact)

    if fits_one_page:
        _draw_signatures_section(c, x0, x1, y, vacation)
        _draw_footer_note(c, page_w, bottom_limit)
    else:
        # Ni siquiera con espaciado compacto entra el bloque de firmas sin
        # invadir el pie de página (ej. préstamos con 3 firmas + trazabilidad
        # larga): se pasa a una segunda página en vez de dibujar encimado.
        c.showPage()
        footer_h = draw_letterhead_footer(c, page_w, x0, x1)
        bottom_limit = footer_h + 26
        y = _draw_letterhead(c, page_w, page_h, x0, x1)
        _text(c, x0, y, f"Gestión de Talento Humano  ·  {vacation.request_number or vacation.id}  ·  continuación", size=8.5, bold=True, color=MUTED)
        y -= 34
        _draw_signatures_section(c, x0, x1, y, vacation)
        _draw_footer_note(c, page_w, bottom_limit)

    c.save()
    buffer.seek(0)
    return _append_support_document(buffer, vacation)
