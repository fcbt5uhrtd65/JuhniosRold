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

NAVY = HexColor("#1b3a6b")
STEEL = HexColor("#2e6da4")
TEXT = HexColor("#1a1a1a")
MUTED = HexColor("#5d6d7e")
LINE = HexColor("#c8d8e8")
SUCCESS = HexColor("#1f8a4c")
WARNING = HexColor("#b7791f")
DANGER = HexColor("#b3261e")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _date(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _datetime(value):
    return f"{value:%d/%m/%Y %H:%M}" if value else "-"


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


def _fit(text, max_width, font=FONT, size=8):
    text = _safe(text, "")
    if stringWidth(text, font, size) <= max_width:
        return text
    suffix = "..."
    while text and stringWidth(text + suffix, font, size) > max_width:
        text = text[:-1]
    return text + suffix if text else suffix


def _draw_logo(c, x, y, size=34):
    if not os.path.exists(LOGO_PATH):
        return 0
    try:
        c.drawImage(ImageReader(LOGO_PATH), x, y - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
    except Exception:
        return 0
    return size


def _employee_name(employee):
    if not employee:
        return "-"
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _status_color(status_text):
    status_text = _safe(status_text, "").upper()
    if "APROB" in status_text or "LIBER" in status_text or "CONFORM" in status_text or "COMPLET" in status_text:
        return SUCCESS
    if "RECHAZ" in status_text or "CANCEL" in status_text or "FUGA" in status_text or "RUPTURA" in status_text:
        return DANGER
    if "PEND" in status_text or "PROCES" in status_text or "CUARENTENA" in status_text:
        return WARNING
    return MUTED


def _document_header(c, page_w, page_h, x0, x1, title, batch, code, version):
    """Encabezado estándar de todo documento individual del expediente:
    logo + empresa + código/versión de formato + producto/lote/OP + título."""
    y = page_h - 44
    logo_size = _draw_logo(c, x0, y, 34)
    text_x = x0 + logo_size + (10 if logo_size else 0)
    _text(c, text_x, y - 12, COMPANY_NAME, size=11.5, bold=True, color=NAVY)
    _text(c, text_x, y - 24, "Gestión de Producción y Calidad", size=8, color=MUTED)

    _text(c, x1, y - 10, f"Código: {code}", size=7.5, color=MUTED, align="right")
    _text(c, x1, y - 20, f"Versión: {version}", size=7.5, color=MUTED, align="right")
    _text(c, x1, y - 30, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=7.5, color=MUTED, align="right")

    y -= 48
    c.setStrokeColor(STEEL)
    c.setLineWidth(1.4)
    c.line(x0, y, x1, y)
    y -= 18

    _text(c, (x0 + x1) / 2, y, title.upper(), size=13, bold=True, color=NAVY, align="center")
    y -= 22

    order = batch.production_order
    product_name = order.output_item.name if order.output_item_id else "-"
    fields = [
        ("Producto", product_name),
        ("Lote", order.batch_code or "-"),
        ("Orden de producción", order.number),
        ("Estado del lote", batch.get_status_display()),
    ]
    col_w = (x1 - x0) / len(fields)
    for index, (label, value) in enumerate(fields):
        fx = x0 + index * col_w
        _text(c, fx, y, label.upper(), size=6.6, bold=True, color=MUTED)
        _text(c, fx, y - 10, _fit(value, col_w - 6), size=8.4)
    y -= 30
    return y


def _document_footer(c, page_w, x0, x1, generated_by_label, page_number, doc_status="-"):
    y = 32
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(x0, y + 10, x1, y + 10)
    _text(c, x0, y, f"Generado por: {generated_by_label}", size=6.8, color=MUTED)
    _text(c, (x0 + x1) / 2, y, f"Estado del documento: {doc_status}", size=6.8, color=MUTED, align="center")
    _text(c, x1, y, f"Página {page_number}", size=6.8, color=MUTED, align="right")


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
    _draw_signature_image(c, x0, y_anchor + 8, min(w, 160), 46, signature_file)
    dot_y = y_anchor + 4
    dot_x = x0
    dot_end = x0 + min(w, 180)
    c.setFillColor(LINE)
    step = 5
    while dot_x < dot_end:
        c.rect(dot_x, dot_y, 2.2, 1, stroke=0, fill=1)
        dot_x += step
    _text(c, x0, y_anchor - 9, _safe(signer_name).upper(), size=8, bold=True, color=NAVY)
    _text(c, x0, y_anchor - 19, role_label, size=7, color=MUTED)


def _draw_generic_signature_image(c, x, y, max_w, max_h, image_field):
    if not image_field:
        return 0
    try:
        if not image_field.storage.exists(image_field.name):
            return 0
        with image_field.open("rb") as fobj:
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


def _draw_signatures(c, x0, y, w, instance):
    """Dibuja las firmas vigentes (responsable/verificador) del modelo
    genérico Signature asociadas a `instance` vía GenericRelation, en el
    mismo formato visual que _draw_signature_block. No aplica a los modelos
    que ya tienen su propio FileField de firma (esos usan _draw_signature_block)."""
    signatures = list(instance.signatures.all()) if hasattr(instance, "signatures") else []
    replaced_ids = {sig.replaced_by_id for sig in signatures if sig.replaced_by_id}
    current = [sig for sig in signatures if sig.id not in replaced_ids]

    responsible = next((sig for sig in current if sig.role == "RESPONSIBLE"), None)
    verifier = next((sig for sig in current if sig.role == "VERIFIER"), None)
    col_w = min(w, 200)

    def _draw_one(x, sig, role_label):
        if sig is None:
            _text(c, x, y - 9, "SIN FIRMA", size=8, bold=True, color=MUTED)
            _text(c, x, y - 19, role_label, size=7, color=MUTED)
            return
        _draw_generic_signature_image(c, x, y + 8, min(col_w, 160), 46, sig.image)
        _text(c, x, y - 9, _safe(sig.full_name).upper(), size=8, bold=True, color=NAVY)
        _text(c, x, y - 19, f"{role_label} · {_datetime(sig.created_at)}", size=6.6, color=MUTED)

    _draw_one(x0, responsible, "Responsable")
    _draw_one(x0 + col_w + 40, verifier, "Verificador")
    return y - 30


def _field_row(c, x0, w, y, pairs, col_count=2):
    col_w = w / col_count
    for index, (label, value) in enumerate(pairs):
        if label is None:
            continue
        col = index % col_count
        row = index // col_count
        fx = x0 + col * col_w
        fy = y - row * 26
        _text(c, fx, fy, label.upper(), size=6.4, bold=True, color=MUTED)
        _text(c, fx, fy - 10, _fit(value, col_w - 8, size=8.6), size=8.6)
    rows = (len(pairs) + col_count - 1) // col_count
    return y - rows * 26


def _section_title(c, x0, x1, y, title):
    _text(c, x0, y, title.upper(), size=9.5, bold=True, color=NAVY)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(x0, y - 5, x1, y - 5)
    return y - 18


# ── Documentos individuales ──────────────────────────────────────────────────

def render_line_clearance_pdf(clearance):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    c.setTitle(f"Despeje de línea - {clearance.batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Despeje de línea de áreas y equipos", clearance.batch, "MFG-LC", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Fase", clearance.get_phase_display()),
        ("Estado", clearance.get_status_display()),
        ("Área", clearance.area.name if clearance.area else "-"),
        ("Línea", clearance.production_line.name if clearance.production_line else "-"),
        ("Producto anterior", clearance.previous_product or "-"),
        ("Lote anterior", clearance.previous_batch_code or "-"),
        ("Fecha de liberación", _datetime(clearance.cleared_at)),
        ("Realizado por", _employee_name(clearance.performed_by)),
    ])
    y -= 10
    y = _section_title(c, x0, x1, y, "Checklist")
    for criterion in clearance.criteria.all():
        result_color = _status_color(criterion.get_result_display())
        _text(c, x0, y, _fit(criterion.get_criterion_display(), 300, size=8.4), size=8.4, bold=True)
        _text(c, x0 + 310, y, criterion.get_result_display(), size=8, color=result_color, bold=True)
        y -= 11
        if criterion.observation:
            _text(c, x0 + 12, y, _fit(f"Obs: {criterion.observation}", x1 - x0 - 12, size=7.4), size=7.4, color=MUTED)
            y -= 11
        y -= 4
        if y < 130:
            _document_footer(c, page_w, x0, x1, "-", 1, clearance.get_status_display())
            c.showPage()
            y = page_h - 60

    y -= 10
    _draw_signature_block(c, x0, y, 200, _employee_name(clearance.verified_by), "Verificador de liberación", clearance.verifier_signature)
    _document_footer(c, page_w, x0, x1, _employee_name(clearance.verified_by), 1, clearance.get_status_display())

    c.save()
    buffer.seek(0)
    return buffer


def render_dispensing_order_pdf(order):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    c.setTitle(f"Orden de dispensación - {order.batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Orden de dispensación y fabricación", order.batch, "MFG-DISP", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Estado", order.get_status_display()),
        ("Fecha de emisión", _date(order.issued_at)),
        ("Responsable", _employee_name(order.responsible)),
        ("Verificador", _employee_name(order.verifier)),
    ])
    y -= 10
    y = _section_title(c, x0, x1, y, "Detalle por materia prima")

    headers = ["#", "Materia prima", "Lote MP", "Teórica", "Pesada", "Desv.%", "Estado"]
    widths = [20, 150, 70, 60, 60, 55, 60]
    cx = x0
    for header, width in zip(headers, widths):
        _text(c, cx, y, header, size=7, bold=True, color=MUTED)
        cx += width
    y -= 10
    c.setStrokeColor(LINE)
    c.line(x0, y + 4, x1, y + 4)

    for line in order.lines.all().order_by("sequence"):
        deviation = line.deviation_percentage
        row = [
            str(line.sequence),
            _fit(line.item.name, widths[1] - 6, size=7.4),
            _fit(line.raw_material_batch.supplier_batch_code if line.raw_material_batch_id else "-", widths[2] - 6, size=7.4),
            f"{line.theoretical_quantity:.3f}",
            f"{line.net_weight:.3f}" if line.net_weight is not None else "-",
            f"{deviation:.2f}" if deviation is not None else "-",
            line.get_status_display(),
        ]
        cx = x0
        for value, width in zip(row, widths):
            _text(c, cx, y, value, size=7.4)
            cx += width
        y -= 12
        if y < 130:
            _document_footer(c, page_w, x0, x1, "-", 1, order.get_status_display())
            c.showPage()
            y = page_h - 60

    y -= 14
    _draw_signature_block(c, x0, y, 180, _employee_name(order.responsible), "Responsable de dispensación", order.responsible_signature)
    _draw_signature_block(c, x0 + 260, y, 180, _employee_name(order.verifier), "Verificador de dispensación", order.verifier_signature)
    _document_footer(c, page_w, x0, x1, _employee_name(order.responsible), 1, order.get_status_display())

    c.save()
    buffer.seek(0)
    return buffer


def render_analysis_certificate_pdf(certificate):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    c.setTitle(f"Certificado de análisis - {certificate.batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Certificado de análisis", certificate.batch, "MFG-CA", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Fecha de fabricación", _date(certificate.manufactured_at)),
        ("Fecha de muestreo", _date(certificate.sampled_at)),
        ("Fecha de análisis", _date(certificate.analyzed_at)),
        ("Concepto", certificate.get_concept_display()),
        ("Analizado por", _employee_name(certificate.analyzed_by)),
        ("Verificado por", _employee_name(certificate.verified_by)),
    ])
    y -= 10
    y = _section_title(c, x0, x1, y, "Ensayos")

    headers = ["Ensayo", "Especificación", "Result. granel", "Result. terminado", "Cumple"]
    widths = [130, 140, 90, 90, 60]
    cx = x0
    for header, width in zip(headers, widths):
        _text(c, cx, y, header, size=7, bold=True, color=MUTED)
        cx += width
    y -= 10
    c.setStrokeColor(LINE)
    c.line(x0, y + 4, x1, y + 4)

    for test in certificate.tests.all():
        complies_label = "Cumple" if test.complies else "No cumple" if test.complies is False else "-"
        row = [
            _fit(test.name, widths[0] - 6, size=7.4),
            _fit(test.specification, widths[1] - 6, size=7.4),
            _fit(test.bulk_result, widths[2] - 6, size=7.4),
            _fit(test.finished_product_result, widths[3] - 6, size=7.4),
            complies_label,
        ]
        cx = x0
        for value, width in zip(row, widths):
            color = _status_color(complies_label) if value == complies_label else TEXT
            _text(c, cx, y, value, size=7.4, color=color)
            cx += width
        y -= 12
        if y < 130:
            _document_footer(c, page_w, x0, x1, "-", 1, certificate.get_concept_display())
            c.showPage()
            y = page_h - 60

    y -= 14
    _draw_signature_block(c, x0, y, 180, _employee_name(certificate.analyzed_by), "Analista", None)
    _draw_signature_block(c, x0 + 260, y, 180, _employee_name(certificate.verified_by), "Verificador de calidad", None)
    _document_footer(c, page_w, x0, x1, _employee_name(certificate.analyzed_by), 1, certificate.get_concept_display())

    c.save()
    buffer.seek(0)
    return buffer


def render_batch_release_pdf(release):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    c.setTitle(f"Liberación de producto terminado - {release.batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Liberación de producto terminado", release.batch, "MFG-REL", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Cantidad liberada", str(release.released_quantity)),
        ("Cantidad retenida", str(release.retained_quantity)),
        ("Cantidad rechazada", str(release.rejected_quantity)),
        ("Condición", release.get_condition_display()),
        ("Fecha de liberación", _datetime(release.released_at)),
        ("Bodega destino", release.warehouse_location.name if release.warehouse_location_id else "-"),
    ])
    y -= 20
    if release.observations:
        y = _section_title(c, x0, x1, y, "Observaciones")
        _text(c, x0, y, _fit(release.observations, x1 - x0, size=8.4), size=8.4)
        y -= 24

    _draw_signature_block(c, x0, y, 200, _employee_name(release.released_by_quality), "Liberado por Calidad", release.quality_signature)
    _draw_signature_block(c, x0 + 280, y, 200, _employee_name(release.approved_by_technical_director), "Aprobado por Director Técnico", release.technical_director_signature)
    _document_footer(c, page_w, x0, x1, _employee_name(release.released_by_quality), 1, release.get_condition_display())

    c.save()
    buffer.seek(0)
    return buffer


def render_document_checklist_pdf(batch):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    c.setTitle(f"Verificación documental - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Verificación de documentos", batch, "MFG-DOC", "1.0")

    items = list(batch.document_checklist.all().order_by("document_code"))
    total = len(items)
    approved = sum(1 for item in items if item.status == item.Status.APPROVED)
    pending = sum(1 for item in items if item.status in (item.Status.PENDING, item.Status.IN_PROGRESS))
    rejected = sum(1 for item in items if item.status == item.Status.REJECTED)
    not_applicable = sum(1 for item in items if not item.applies)
    percentage = round((approved / total) * 100) if total else 0

    y = _field_row(c, x0, x1 - x0, y, [
        ("Total documentos", str(total)),
        ("Completados", str(approved)),
        ("Pendientes", str(pending)),
        ("Rechazados", str(rejected)),
        ("No aplican", str(not_applicable)),
        ("% expediente", f"{percentage}%"),
    ], col_count=3)
    y -= 14
    y = _section_title(c, x0, x1, y, "Documentos del expediente")

    for item in items:
        status_color = _status_color(item.get_status_display())
        _text(c, x0, y, _fit(item.name, 300, size=8), size=8, bold=True)
        _text(c, x0 + 310, y, item.get_status_display(), size=7.6, color=status_color, bold=True)
        _text(c, x0 + 420, y, item.get_result_display(), size=7.6, color=MUTED)
        y -= 12
        if y < 100:
            _document_footer(c, page_w, x0, x1, "-", 1, f"{percentage}%")
            c.showPage()
            y = page_h - 60

    _document_footer(c, page_w, x0, x1, "-", 1, f"{percentage}%")
    c.save()
    buffer.seek(0)
    return buffer


def render_raw_material_identification_pdf(dispensing_line):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = dispensing_line.order.batch
    c.setTitle(f"Identificación de materia prima - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Identificación de materia prima dispensada", batch, "MFG-RMID", "1.0")
    raw_batch = dispensing_line.raw_material_batch
    y = _field_row(c, x0, x1 - x0, y, [
        ("Código de materia prima", dispensing_line.item.code if dispensing_line.item_id else "-"),
        ("Nombre de materia prima", dispensing_line.item.name if dispensing_line.item_id else "-"),
        ("Lote de materia prima", raw_batch.supplier_batch_code if raw_batch else "-"),
        ("Número de análisis", raw_batch.analysis_number if raw_batch else "-"),
        ("Fecha de vencimiento", _date(raw_batch.expires_at) if raw_batch else "-"),
        ("Estado de calidad", raw_batch.get_quality_status_display() if raw_batch else "-"),
        ("Tara", str(dispensing_line.tare) if dispensing_line.tare is not None else "-"),
        ("Peso bruto", str(dispensing_line.gross_weight) if dispensing_line.gross_weight is not None else "-"),
        ("Peso neto", str(dispensing_line.net_weight) if dispensing_line.net_weight is not None else "-"),
        ("Recipiente", dispensing_line.container or "-"),
        ("Pesado por", _employee_name(dispensing_line.weighed_by)),
        ("Verificado por", _employee_name(dispensing_line.verified_by)),
        ("Fecha y hora de pesada", _datetime(dispensing_line.weighed_at)),
    ], col_count=3)
    y -= 10

    prints = list(dispensing_line.identification_prints.order_by("-printed_at"))
    if prints:
        y = _section_title(c, x0, x1, y, "Historial de impresión")
        for entry in prints:
            label = "Reimpresión" if entry.is_reprint else "Impresión original"
            _text(c, x0, y, f"{label} · {_datetime(entry.printed_at)} · {entry.printed_by}", size=7.8)
            y -= 10
            if entry.is_reprint and entry.reprint_reason:
                _text(c, x0 + 12, y, _fit(f"Motivo: {entry.reprint_reason}", x1 - x0 - 12, size=7.2), size=7.2, color=MUTED)
                y -= 10
            y -= 4

    _document_footer(c, page_w, x0, x1, "-", 1, dispensing_line.get_status_display())
    c.save()
    buffer.seek(0)
    return buffer


def render_line_identification_pdf(line_identification):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = line_identification.batch
    c.setTitle(f"Identificación de línea - {batch}")

    order = batch.production_order
    y = _document_header(c, page_w, page_h, x0, x1, "Identificación de línea", batch, "MFG-LID", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Producto", order.output_item.name if order.output_item_id else "-"),
        ("Cantidad", str(order.planned_quantity)),
        ("Lote", order.batch_code or "-"),
        ("Orden de producción", order.number),
        ("Área", line_identification.area.name if line_identification.area else "-"),
        ("Línea", line_identification.production_line.name if line_identification.production_line else "-"),
        ("Colocada", _datetime(line_identification.placed_at)),
        ("Colocada por", _employee_name(line_identification.placed_by)),
        ("Retirada", _datetime(line_identification.removed_at)),
        ("Retirada por", _employee_name(line_identification.removed_by)),
    ])
    y -= 14
    y = _draw_signatures(c, x0, y, x1 - x0, line_identification)
    _document_footer(c, page_w, x0, x1, _employee_name(line_identification.placed_by), 1)
    c.save()
    buffer.seek(0)
    return buffer


def render_cleaning_record_pdf(record):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = record.batch
    c.setTitle(f"Área y equipo limpio - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Área y equipo limpio", batch, "MFG-CLEAN", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Tipo", record.get_record_type_display()),
        ("Área", record.area or "-"),
        ("Equipo", record.equipment or "-"),
        ("Código del equipo", record.equipment_code or "-"),
        ("Fecha y hora de limpieza", _datetime(record.cleaned_at)),
        ("Producto anterior", record.previous_product or "-"),
        ("Lote anterior", record.previous_batch_code or "-"),
        ("Método de limpieza", record.cleaning_method or "-"),
        ("Sanitizante", record.sanitizer or "-"),
        ("Concentración", record.sanitizer_concentration or "-"),
        ("Lote del sanitizante", record.sanitizer_batch or "-"),
        ("Vencimiento del sanitizante", _date(record.sanitizer_expires_at)),
        ("Resultado", record.get_result_display() if record.result else "-"),
        ("Vigencia de la limpieza", _datetime(record.valid_until)),
        ("Vencida", "Sí" if record.is_expired else "No"),
    ], col_count=3)
    y -= 10
    if record.observations:
        y = _section_title(c, x0, x1, y, "Observaciones")
        _text(c, x0, y, _fit(record.observations, x1 - x0, size=8.4), size=8.4)
        y -= 24
    y = _draw_signatures(c, x0, y, x1 - x0, record)
    _document_footer(c, page_w, x0, x1, _employee_name(record.performed_by), 1, record.get_result_display() if record.result else "-")
    c.save()
    buffer.seek(0)
    return buffer


def render_manufacturing_steps_pdf(batch):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    c.setTitle(f"Instrucciones de fabricación - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Instrucciones de fabricación", batch, "MFG-STEP", "1.0")

    for execution in batch.step_executions.select_related("step").order_by("step__sequence"):
        step = execution.step
        status_color = _status_color(execution.get_status_display())
        _text(c, x0, y, f"Paso {step.sequence}. {step.phase or '-'}", size=9, bold=True)
        _text(c, x1, y, execution.get_status_display(), size=8, bold=True, color=status_color, align="right")
        y -= 11
        _text(c, x0, y, _fit(step.instruction, x1 - x0, size=7.8), size=7.8, color=MUTED)
        y -= 12
        y = _field_row(c, x0, x1 - x0, y, [
            ("Equipo", step.required_equipment or "-"),
            ("Temp. objetivo/real", f"{step.target_temperature or '-'} / {execution.actual_temperature or '-'}"),
            ("Tiempo objetivo/real (min)", f"{step.target_time_minutes or '-'} / {execution.actual_time_minutes or '-'}"),
            ("pH objetivo/real", f"{step.target_ph or '-'} / {execution.actual_ph or '-'}"),
            ("Velocidad agitación", execution.actual_agitation_speed or step.target_agitation_speed or "-"),
            ("Presión", execution.actual_pressure or step.target_pressure or "-"),
            ("Realizado por", _employee_name(execution.performed_by)),
            ("Verificado por", _employee_name(execution.verified_by)),
            ("Inicio", _datetime(execution.started_at)),
            ("Fin", _datetime(execution.finished_at)),
        ], col_count=2)
        if execution.deviation:
            _text(c, x0, y, _fit(f"Desviación: {execution.deviation}", x1 - x0, size=7.6), size=7.6, color=DANGER)
            y -= 12
        y = _draw_signatures(c, x0, y, x1 - x0, execution)
        y -= 16
        if y < 130:
            _document_footer(c, page_w, x0, x1, "-", 1)
            c.showPage()
            y = page_h - 60

    _document_footer(c, page_w, x0, x1, "-", 1)
    c.save()
    buffer.seek(0)
    return buffer


def render_production_control_pdf(control):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = control.batch
    c.setTitle(f"Control de producción - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Control de producción", batch, "MFG-PROD", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Tamaño del lote", str(control.lot_size or "-")),
        ("Unidad", control.unit.abbreviation if control.unit_id else "-"),
    ])
    y -= 10
    y = _section_title(c, x0, x1, y, "Materiales de acondicionamiento")

    headers = ["Material", "Solicit.", "Entreg.", "Devuelto", "Adicional", "Buenas", "Malas proc.", "Malas fáb.", "Dif."]
    widths = [130, 45, 45, 50, 50, 45, 55, 55, 45]
    cx = x0
    for header, width in zip(headers, widths):
        _text(c, cx, y, header, size=6.6, bold=True, color=MUTED)
        cx += width
    y -= 10
    c.setStrokeColor(LINE)
    c.line(x0, y + 4, x1, y + 4)

    for material in control.materials.all():
        diff = material.reconciliation_difference
        row = [
            _fit(material.item.name, widths[0] - 6, size=7.2),
            str(material.requested_quantity),
            str(material.delivered_quantity),
            str(material.returned_quantity),
            str(material.additional_quantity),
            str(material.good_units),
            str(material.process_rejects),
            str(material.factory_rejects),
            str(diff),
        ]
        cx = x0
        for index, (value, width) in enumerate(zip(row, widths)):
            color = (WARNING if diff != 0 else TEXT) if index == len(row) - 1 else TEXT
            _text(c, cx, y, value, size=7.2, color=color)
            cx += width
        y -= 11
        if y < 130:
            _document_footer(c, page_w, x0, x1, "-", 1)
            c.showPage()
            y = page_h - 60

    y -= 14
    y = _draw_signatures(c, x0, y, x1 - x0, control)
    _document_footer(c, page_w, x0, x1, "-", 1)
    c.save()
    buffer.seek(0)
    return buffer


def render_filling_control_pdf(control):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = control.batch
    c.setTitle(f"Control de llenado - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Control de llenado", batch, "MFG-FILL", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Línea", control.production_line.name if control.production_line else "-"),
        ("Equipo", control.equipment or "-"),
        ("Tanque de origen", control.source_tank or "-"),
        ("Inicio", _datetime(control.started_at)),
        ("Fin", _datetime(control.finished_at)),
        ("Responsable", _employee_name(control.responsible)),
        ("Verificador", _employee_name(control.verifier)),
        ("Cantidad programada", str(control.planned_quantity or "-")),
        ("Cantidad producida", str(control.produced_quantity)),
        ("Cantidad rechazada", str(control.rejected_quantity)),
        ("Cantidad recuperada", str(control.recovered_quantity)),
        ("Rendimiento", f"{control.yield_percentage:.1f}%" if control.yield_percentage is not None else "-"),
    ], col_count=3)
    y -= 10

    participants = list(control.participants.all())
    if participants:
        y = _section_title(c, x0, x1, y, "Personal participante")
        for participant in participants:
            _text(c, x0, y, _fit(f"{participant.activity or participant.role} — {_employee_name(participant.employee)}", x1 - x0, size=7.8), size=7.8)
            y -= 10
            _text(c, x0, y, f"Ingreso: {_datetime(participant.check_in)}  ·  Salida: {_datetime(participant.check_out)}", size=7, color=MUTED)
            y -= 14
            if y < 130:
                _document_footer(c, page_w, x0, x1, "-", 1)
                c.showPage()
                y = page_h - 60

    log_entries = list(control.log_entries.all())
    if log_entries:
        y = _section_title(c, x0, x1, y, "Registros periódicos")
        for entry in log_entries:
            _text(c, x0, y, f"{_datetime(entry.recorded_at)} — Producidas: {entry.units_produced}  Rechazadas: {entry.units_rejected}", size=7.6)
            y -= 12
            if y < 130:
                _document_footer(c, page_w, x0, x1, "-", 1)
                c.showPage()
                y = page_h - 60

    y -= 10
    y = _draw_signatures(c, x0, y, x1 - x0, control)
    _document_footer(c, page_w, x0, x1, _employee_name(control.responsible), 1)
    c.save()
    buffer.seek(0)
    return buffer


def render_weight_volume_control_pdf(control):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = control.batch
    c.setTitle(f"Control de peso o volumen - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Control de peso o volumen", batch, "MFG-WV", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Tara", str(control.tare or "-")),
        ("Límite inferior", str(control.lower_limit or "-")),
        ("Límite superior", str(control.upper_limit or "-")),
        ("Unidad", control.unit.abbreviation if control.unit_id else "-"),
        ("Resultado general", control.get_overall_result_display()),
        ("Autorizó reanudación", _employee_name(control.resumed_authorized_by) if control.resumed_authorized_by_id else "-"),
    ])
    y -= 10
    y = _section_title(c, x0, x1, y, "Muestras")

    samples = list(control.samples.all())
    net_values = [float(sample.net_weight) for sample in samples if sample.net_weight is not None]
    if net_values:
        average = sum(net_values) / len(net_values)
        minimum, maximum = min(net_values), max(net_values)
        out_of_spec = sum(1 for sample in samples if sample.result == "NO")
        pct_out_of_spec = round((out_of_spec / len(samples)) * 100) if samples else 0
        y = _field_row(c, x0, x1 - x0, y, [
            ("Promedio", f"{average:.3f}"),
            ("Mínimo", f"{minimum:.3f}"),
            ("Máximo", f"{maximum:.3f}"),
            ("% fuera de especificación", f"{pct_out_of_spec}%"),
        ])
        y -= 10

    for sample in samples:
        result_color = _status_color(sample.get_result_display())
        _text(c, x0, y, f"Muestra {sample.sample_number}", size=7.8, bold=True)
        _text(c, x0 + 90, y, f"Bruto: {sample.gross_weight or '-'}  Tara: {sample.tare or '-'}  Neto: {sample.net_weight if sample.net_weight is not None else '-'}", size=7.4, color=MUTED)
        _text(c, x1, y, sample.get_result_display(), size=7.6, bold=True, color=result_color, align="right")
        y -= 11
        if sample.adjustment_made:
            _text(c, x0 + 12, y, _fit(f"Ajuste: {sample.adjustment_made}", x1 - x0 - 12, size=7), size=7, color=MUTED)
            y -= 10
        if y < 130:
            _document_footer(c, page_w, x0, x1, "-", 1, control.get_overall_result_display())
            c.showPage()
            y = page_h - 60

    y -= 14
    y = _draw_signatures(c, x0, y, x1 - x0, control)
    _document_footer(c, page_w, x0, x1, "-", 1, control.get_overall_result_display())
    c.save()
    buffer.seek(0)
    return buffer


def render_seal_integrity_control_pdf(control):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = control.batch
    c.setTitle(f"Control de hermeticidad - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Control de hermeticidad", batch, "MFG-SEAL", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Equipo", control.equipment or "-"),
        ("Código del equipo", control.equipment_code or "-"),
        ("Fecha y hora", _datetime(control.tested_at)),
        ("Presión (bar)", str(control.pressure_bar or "-")),
        ("Tiempo (s)", str(control.time_seconds or "-")),
        ("Resultado general", control.get_overall_result_display()),
    ])
    y -= 10
    y = _section_title(c, x0, x1, y, "Muestras")

    for sample in control.samples.all():
        result_color = _status_color(sample.get_result_display())
        _text(c, x0, y, f"Muestra {sample.sample_number}", size=7.8, bold=True)
        _text(c, x1, y, sample.get_result_display(), size=7.8, bold=True, color=result_color, align="right")
        y -= 10
        if sample.observation:
            _text(c, x0 + 12, y, _fit(sample.observation, x1 - x0 - 12, size=7.2), size=7.2, color=MUTED)
            y -= 10
        y -= 4
        if y < 130:
            _document_footer(c, page_w, x0, x1, "-", 1, control.get_overall_result_display())
            c.showPage()
            y = page_h - 60

    if control.observations:
        y = _section_title(c, x0, x1, y, "Observaciones")
        _text(c, x0, y, _fit(control.observations, x1 - x0, size=8.4), size=8.4)
        y -= 24

    y = _draw_signatures(c, x0, y, x1 - x0, control)
    _document_footer(c, page_w, x0, x1, "-", 1, control.get_overall_result_display())
    c.save()
    buffer.seek(0)
    return buffer


def render_packaging_control_pdf(control):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = control.batch
    c.setTitle(f"Control de acondicionamiento - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Control de acondicionamiento", batch, "MFG-PKG", "1.0")
    y = _section_title(c, x0, x1, y, "Etiqueta testigo")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Código de etiqueta", control.label_code or "-"),
        ("Versión del arte", control.artwork_version or "-"),
        ("Lote del material", control.label_material_batch or "-"),
        ("Resultado", control.get_label_result_display() if control.label_result else "-"),
        ("Realizado por", _employee_name(control.label_performed_by)),
        ("Verificado por", _employee_name(control.label_verified_by)),
    ])
    y -= 10

    y = _section_title(c, x0, x1, y, "Loteado")
    for marking in control.lot_markings.all():
        stage_label = "Loteado inicial" if marking.stage == "INITIAL" else "Loteado final"
        result_color = _status_color(marking.get_result_display()) if marking.result else MUTED
        _text(c, x0, y, stage_label, size=8.2, bold=True)
        _text(c, x0 + 150, y, marking.printed_batch_code or "-", size=7.8, color=MUTED)
        _text(c, x1, y, marking.get_result_display() if marking.result else "-", size=7.8, bold=True, color=result_color, align="right")
        y -= 10
        _text(c, x0, y, f"Fabricación: {_date(marking.manufacture_date)}  ·  Vence: {_date(marking.expiry_date)}  ·  Legible: {'Sí' if marking.is_legible else 'No' if marking.is_legible is False else '-'}  ·  Ubicación correcta: {'Sí' if marking.is_correctly_placed else 'No' if marking.is_correctly_placed is False else '-'}", size=7, color=MUTED)
        y -= 16
        if y < 130:
            _document_footer(c, page_w, x0, x1, "-", 1)
            c.showPage()
            y = page_h - 60

    y = _section_title(c, x0, x1, y, "Conciliación de empaque")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Unidades por display", str(control.units_per_display or "-")),
        ("Displays por caja", str(control.displays_per_box or "-")),
        ("Unidades por caja", str(control.units_per_box or "-")),
        ("Cajas completas", str(control.complete_boxes)),
        ("Displays incompletos", str(control.incomplete_displays)),
        ("Unidades sueltas", str(control.loose_units)),
        ("Total conciliado", str(control.total_reconciled)),
        ("Saldos", str(control.balances)),
        ("Rechazos", str(control.rejections)),
    ], col_count=3)
    if control.rejection_reasons:
        y -= 10
        _text(c, x0, y, _fit(f"Motivos de rechazo: {control.rejection_reasons}", x1 - x0, size=7.8), size=7.8, color=MUTED)
        y -= 20

    y = _draw_signatures(c, x0, y, x1 - x0, control)
    _document_footer(c, page_w, x0, x1, _employee_name(control.responsible), 1)
    c.save()
    buffer.seek(0)
    return buffer


def render_microbiology_analysis_pdf(microbiology):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    batch = microbiology.batch
    c.setTitle(f"Análisis microbiológico - {batch}")

    y = _document_header(c, page_w, page_h, x0, x1, "Análisis microbiológico", batch, "MFG-MICRO", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Código de muestra", microbiology.sample_code or "-"),
        ("Tipo de muestra", microbiology.sample_type or "-"),
        ("Fecha de toma", _date(microbiology.taken_at)),
        ("Tomada por", _employee_name(microbiology.taken_by)),
        ("Fecha de envío", _date(microbiology.sent_at)),
        ("Laboratorio", microbiology.laboratory or "-"),
        ("N.º de informe", microbiology.report_number or "-"),
        ("Resultado general", microbiology.get_overall_result_display()),
        ("Fecha de aprobación", _date(microbiology.approved_at)),
        ("Aprobado por", _employee_name(microbiology.approved_by)),
    ], col_count=2)
    y -= 10

    if microbiology.results:
        y = _section_title(c, x0, x1, y, "Resultados")
        for result in microbiology.results:
            name = result.get("name", "-") if isinstance(result, dict) else str(result)
            value = result.get("value", "-") if isinstance(result, dict) else "-"
            _text(c, x0, y, _fit(f"{name}: {value}", x1 - x0, size=7.8), size=7.8)
            y -= 11
            if y < 130:
                _document_footer(c, page_w, x0, x1, "-", 1, microbiology.get_overall_result_display())
                c.showPage()
                y = page_h - 60
        y -= 10

    if microbiology.observations:
        y = _section_title(c, x0, x1, y, "Observaciones")
        _text(c, x0, y, _fit(microbiology.observations, x1 - x0, size=8.4), size=8.4)
        y -= 24

    y = _draw_signatures(c, x0, y, x1 - x0, microbiology)
    _document_footer(c, page_w, x0, x1, _employee_name(microbiology.approved_by), 1, microbiology.get_overall_result_display())
    c.save()
    buffer.seek(0)
    return buffer


# ── Expediente completo del lote ─────────────────────────────────────────────

def render_full_batch_dossier_pdf(batch, *, include_attachments=True, include_photos=True, include_not_applicable=False):
    """Genera un único PDF con el expediente completo del lote, respetando el
    orden cronológico del proceso pedido en el requerimiento."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter
    x0, x1 = 50, page_w - 50
    c.setTitle(f"Expediente completo - {batch}")

    order = batch.production_order

    # 1. Portada
    y = page_h - 140
    logo_size = _draw_logo(c, (page_w - 60) / 2, page_h - 90, 60)
    _text(c, page_w / 2, y, COMPANY_NAME, size=18, bold=True, color=NAVY, align="center")
    y -= 24
    _text(c, page_w / 2, y, "EXPEDIENTE COMPLETO DE FABRICACIÓN DE LOTE", size=13, color=STEEL, align="center")
    y -= 50
    _text(c, page_w / 2, y, f"Producto: {order.output_item.name if order.output_item_id else '-'}", size=11, align="center")
    y -= 16
    _text(c, page_w / 2, y, f"Lote: {order.batch_code or '-'}    ·    Orden de producción: {order.number}", size=10, color=MUTED, align="center")
    y -= 16
    _text(c, page_w / 2, y, f"Estado: {batch.get_status_display()}", size=10, color=_status_color(batch.get_status_display()), bold=True, align="center")
    y -= 40
    _text(c, page_w / 2, y, f"Generado: {timezone.now():%d/%m/%Y %H:%M}", size=8.5, color=MUTED, align="center")

    # 2. Información general de la orden
    c.showPage()
    y = _document_header(c, page_w, page_h, x0, x1, "2. Información general de la orden", batch, "MFG-GEN", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Producto", order.output_item.name if order.output_item_id else "-"),
        ("Presentación / cantidad planificada", str(order.planned_quantity)),
        ("Lote", order.batch_code or "-"),
        ("Fórmula", order.formula.name if order.formula_id else "-"),
        ("Responsable de producción", _employee_name(batch.production_manager)),
        ("Responsable de calidad", _employee_name(batch.quality_manager)),
        ("Área", batch.area.name if batch.area else "-"),
        ("Línea", batch.production_line.name if batch.production_line else "-"),
        ("Fecha programada", _date(batch.scheduled_at)),
        ("Fecha real de inicio", _datetime(batch.actual_start_at)),
        ("Fecha real de terminación", _datetime(batch.actual_end_at)),
        ("Estado", batch.get_status_display()),
    ], col_count=2)
    if batch.notes:
        y -= 10
        y = _section_title(c, x0, x1, y, "Observaciones")
        _text(c, x0, y, _fit(batch.notes, x1 - x0, size=8.4), size=8.4)
    _document_footer(c, page_w, x0, x1, "-", 2, batch.get_status_display())

    # 3. Verificación documental (resumen — el detalle está en su propia sección)
    c.showPage()
    items = list(batch.document_checklist.all().order_by("document_code"))
    if not include_not_applicable:
        items = [item for item in items if item.applies]
    total = len(items)
    approved = sum(1 for item in items if item.status == item.Status.APPROVED)
    percentage = round((approved / total) * 100) if total else 0
    y = _document_header(c, page_w, page_h, x0, x1, "3. Verificación documental", batch, "MFG-DOC", "1.0")
    y = _field_row(c, x0, x1 - x0, y, [
        ("Total documentos", str(total)),
        ("Completados", str(approved)),
        ("% expediente", f"{percentage}%"),
    ], col_count=3)
    y -= 10
    for item in items:
        status_color = _status_color(item.get_status_display())
        _text(c, x0, y, _fit(item.name, 320, size=8.2))
        _text(c, x0 + 330, y, item.get_status_display(), size=7.8, color=status_color, bold=True)
        y -= 12
        if y < 100:
            _document_footer(c, page_w, x0, x1, "-", 3, f"{percentage}%")
            c.showPage()
            y = page_h - 60
    _document_footer(c, page_w, x0, x1, "-", 3, f"{percentage}%")

    # 4. Dispensación
    dispensing_order = getattr(batch, "dispensing_order", None)
    if dispensing_order is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "4. Dispensación", batch, "MFG-DISP", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [
            ("Estado", dispensing_order.get_status_display()),
            ("Responsable", _employee_name(dispensing_order.responsible)),
            ("Verificador", _employee_name(dispensing_order.verifier)),
        ])
        y -= 10
        for line in dispensing_order.lines.all().order_by("sequence"):
            _text(c, x0, y, _fit(f"{line.sequence}. {line.item.name}", 300, size=8), size=8)
            _text(c, x0 + 310, y, f"Teórica: {line.theoretical_quantity} / Pesada: {line.net_weight or '-'}", size=7.4, color=MUTED)
            y -= 12
            if y < 100:
                _document_footer(c, page_w, x0, x1, "-", 4, dispensing_order.get_status_display())
                c.showPage()
                y = page_h - 60
        _document_footer(c, page_w, x0, x1, "-", 4, dispensing_order.get_status_display())

    # 5. Despejes de línea
    clearances = list(batch.line_clearances.all())
    if clearances:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "5. Despejes de línea", batch, "MFG-LC", "1.0")
        for clearance in clearances:
            _text(c, x0, y, f"{clearance.get_phase_display()} — {clearance.get_status_display()}", size=8.6, bold=True, color=_status_color(clearance.get_status_display()))
            y -= 10
            _text(c, x0, y, f"Área: {clearance.area.name if clearance.area else '-'}  ·  Fecha: {_datetime(clearance.cleared_at)}  ·  Realizado por: {_employee_name(clearance.performed_by)}", size=7.6, color=MUTED)
            y -= 16
            if y < 100:
                _document_footer(c, page_w, x0, x1, "-", 5)
                c.showPage()
                y = page_h - 60
        _document_footer(c, page_w, x0, x1, "-", 5)

    # 6. Limpiezas
    cleanings = list(batch.cleaning_records.all())
    if cleanings:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "6. Limpiezas de área y equipo", batch, "MFG-CLEAN", "1.0")
        for record in cleanings:
            _text(c, x0, y, f"{record.get_record_type_display()} — {record.area or record.equipment or '-'}", size=8.6, bold=True)
            y -= 10
            _text(c, x0, y, f"Sanitizante: {record.sanitizer or '-'}  ·  Fecha: {_datetime(record.cleaned_at)}  ·  Resultado: {record.get_result_display() if record.result else '-'}", size=7.6, color=MUTED)
            y -= 16
            if y < 100:
                _document_footer(c, page_w, x0, x1, "-", 6)
                c.showPage()
                y = page_h - 60
        _document_footer(c, page_w, x0, x1, "-", 6)

    # 7. Identificación de línea
    line_identification = getattr(batch, "line_identification", None)
    if line_identification is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "7. Identificación de línea", batch, "MFG-LID", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [
            ("Área", line_identification.area.name if line_identification.area else "-"),
            ("Línea", line_identification.production_line.name if line_identification.production_line else "-"),
            ("Colocada", _datetime(line_identification.placed_at)),
            ("Colocada por", _employee_name(line_identification.placed_by)),
        ])
        _document_footer(c, page_w, x0, x1, "-", 7)

    # 10. Instrucciones de fabricación (numeración conserva el orden pedido)
    step_executions = list(batch.step_executions.select_related("step").order_by("step__sequence"))
    if step_executions:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "10. Instrucciones de fabricación", batch, "MFG-STEP", "1.0")
        for execution in step_executions:
            _text(c, x0, y, f"Paso {execution.step.sequence}. {execution.step.phase or '-'}", size=8.4, bold=True)
            _text(c, x0 + 320, y, execution.get_status_display(), size=7.8, color=_status_color(execution.get_status_display()))
            y -= 10
            _text(c, x0, y, _fit(execution.step.instruction, x1 - x0, size=7.6), size=7.6, color=MUTED)
            y -= 16
            if y < 100:
                _document_footer(c, page_w, x0, x1, "-", 10)
                c.showPage()
                y = page_h - 60
        _document_footer(c, page_w, x0, x1, "-", 10)

    # 11. Control de producción
    production_control = getattr(batch, "production_control", None)
    if production_control is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "11. Control de producción", batch, "MFG-PROD", "1.0")
        for material in production_control.materials.all():
            _text(c, x0, y, _fit(material.item.name, 300, size=8), size=8)
            _text(c, x0 + 310, y, f"Consumo: {material.consumed_quantity}  Dif: {material.reconciliation_difference}", size=7.4, color=MUTED)
            y -= 14
            if y < 100:
                _document_footer(c, page_w, x0, x1, "-", 11)
                c.showPage()
                y = page_h - 60
        _document_footer(c, page_w, x0, x1, "-", 11)

    # 12. Control de llenado
    filling_control = getattr(batch, "filling_control", None)
    if filling_control is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "12. Control de llenado", batch, "MFG-FILL", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [
            ("Cantidad programada", str(filling_control.planned_quantity or "-")),
            ("Cantidad producida", str(filling_control.produced_quantity)),
            ("Cantidad rechazada", str(filling_control.rejected_quantity)),
            ("Rendimiento", f"{filling_control.yield_percentage:.1f}%" if filling_control.yield_percentage is not None else "-"),
        ])
        _document_footer(c, page_w, x0, x1, "-", 12)

    # 13. Peso o volumen
    weight_control = getattr(batch, "weight_volume_control", None)
    if weight_control is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "13. Control de peso o volumen", batch, "MFG-WV", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [
            ("Límite inferior", str(weight_control.lower_limit or "-")),
            ("Límite superior", str(weight_control.upper_limit or "-")),
            ("Resultado general", weight_control.get_overall_result_display()),
        ])
        y -= 10
        for sample in weight_control.samples.all():
            _text(c, x0, y, f"Muestra {sample.sample_number}: neto {sample.net_weight if sample.net_weight is not None else '-'} — {sample.get_result_display()}", size=7.8)
            y -= 11
            if y < 100:
                _document_footer(c, page_w, x0, x1, "-", 13)
                c.showPage()
                y = page_h - 60
        _document_footer(c, page_w, x0, x1, "-", 13)

    # 14. Hermeticidad
    seal_control = getattr(batch, "seal_integrity_control", None)
    if seal_control is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "14. Control de hermeticidad", batch, "MFG-SEAL", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [
            ("Presión (bar)", str(seal_control.pressure_bar or "-")),
            ("Tiempo (s)", str(seal_control.time_seconds or "-")),
            ("Resultado general", seal_control.get_overall_result_display()),
        ])
        _document_footer(c, page_w, x0, x1, "-", 14)

    # 15. Acondicionamiento
    packaging_control = getattr(batch, "packaging_control", None)
    if packaging_control is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "15. Control de acondicionamiento", batch, "MFG-PKG", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [
            ("Cajas completas", str(packaging_control.complete_boxes)),
            ("Displays incompletos", str(packaging_control.incomplete_displays)),
            ("Unidades sueltas", str(packaging_control.loose_units)),
            ("Total conciliado", str(packaging_control.total_reconciled)),
        ])
        _document_footer(c, page_w, x0, x1, "-", 15)

    # 16. Certificados de análisis
    certificate = getattr(batch, "analysis_certificate", None)
    if certificate is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "16. Certificado de análisis", batch, "MFG-CA", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [("Concepto", certificate.get_concept_display())])
        y -= 10
        for test in certificate.tests.all():
            _text(c, x0, y, _fit(f"{test.name}: {test.bulk_result or '-'} / {test.finished_product_result or '-'}", x1 - x0, size=7.8), size=7.8)
            y -= 11
            if y < 100:
                _document_footer(c, page_w, x0, x1, "-", 16)
                c.showPage()
                y = page_h - 60
        _document_footer(c, page_w, x0, x1, "-", 16)

    # 17. Microbiología
    microbiology = getattr(batch, "microbiology_analysis", None)
    if microbiology is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "17. Análisis microbiológico", batch, "MFG-MICRO", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [
            ("Laboratorio", microbiology.laboratory or "-"),
            ("N.º informe", microbiology.report_number or "-"),
            ("Resultado general", microbiology.get_overall_result_display()),
        ])
        _document_footer(c, page_w, x0, x1, "-", 17)

    # 19. Firmas y 20. Liberación final
    release = getattr(batch, "release", None)
    if release is not None:
        c.showPage()
        y = _document_header(c, page_w, page_h, x0, x1, "20. Liberación final", batch, "MFG-REL", "1.0")
        y = _field_row(c, x0, x1 - x0, y, [
            ("Cantidad liberada", str(release.released_quantity)),
            ("Cantidad retenida", str(release.retained_quantity)),
            ("Cantidad rechazada", str(release.rejected_quantity)),
            ("Condición", release.get_condition_display()),
        ])
        y -= 20
        _draw_signature_block(c, x0, y, 200, _employee_name(release.released_by_quality), "Liberado por Calidad", release.quality_signature)
        _draw_signature_block(c, x0 + 280, y, 200, _employee_name(release.approved_by_technical_director), "Director Técnico", release.technical_director_signature)
        _document_footer(c, page_w, x0, x1, "-", 20, release.get_condition_display())

    # 21. Anexos
    if include_attachments:
        attachments = list(batch.attachments.all())
        if attachments:
            c.showPage()
            y = _document_header(c, page_w, page_h, x0, x1, "21. Anexos", batch, "MFG-ANNEX", "1.0")
            for attachment in attachments:
                _text(c, x0, y, _fit(attachment.original_name or attachment.file.name, x1 - x0, size=8), size=8)
                y -= 12
                if y < 100:
                    _document_footer(c, page_w, x0, x1, "-", 21)
                    c.showPage()
                    y = page_h - 60
            _document_footer(c, page_w, x0, x1, "-", 21)

    c.save()
    buffer.seek(0)
    return buffer
