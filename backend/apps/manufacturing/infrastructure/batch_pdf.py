"""Generación de PDF del expediente de lote y sus documentos individuales.

Construido con reportlab.platypus (Table/Paragraph/KeepTogether sobre un
BaseDocTemplate sencillo) en vez de dibujo manual de canvas: cada bloque
(tabla, firma, título) reserva su propio espacio y platypus decide los saltos
de página, evitando solapamientos entre elementos. El estilo visual (rejilla
completa en las tablas, encabezado en caja, tipografía sobria) replica los
formatos físicos PRD-FR-* de planta en vez del look de "reporte de app".
"""
import io
import os

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from shared.infrastructure.pdf_letterhead import format_time_co

from .models import LineClearance

COMPANY_NAME = "PRODUCTOS JUHNIOS ROLD SAS"
LOGO_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "finance", "infrastructure", "assets", "logo.jpeg")
)

# ── Paleta: sobria, cercana al formato físico impreso (grises/negros, azul
# institucional solo para títulos y acentos de estado). Nada de degradados ni
# tarjetas de color — el documento debe leerse como un formulario GMP, no
# como un dashboard. ──────────────────────────────────────────────────────
INK = colors.HexColor("#1a1d21")
NAVY = colors.HexColor("#16324a")
MUTED = colors.HexColor("#5b6672")
RULE = colors.HexColor("#9aa5b1")
GRID = colors.HexColor("#c7ccd1")
HEAD_BG = colors.HexColor("#eef1f4")
ZEBRA_BG = colors.HexColor("#f7f8f9")
SUCCESS = colors.HexColor("#1e7a42")
WARNING = colors.HexColor("#9a6a10")
DANGER = colors.HexColor("#a3281f")
WHITE = colors.white

PAGE_SIZE = letter
PAGE_W, PAGE_H = PAGE_SIZE
MARGIN = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_IT = "Helvetica-Oblique"


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _date(value):
    return f"{value:%d/%m/%Y}" if value else "-"


def _datetime(value):
    return f"{value:%d/%m/%Y} {format_time_co(value)}" if value else "-"


def _employee_name(employee):
    if not employee:
        return "-"
    return f"{_safe(employee.first_name, '')} {_safe(employee.last_name, '')}".strip() or _safe(employee.employee_code)


def _status_color(status_text):
    status_text = _safe(status_text, "").upper()
    if "APROB" in status_text or "LIBER" in status_text or "CONFORM" in status_text or "COMPLET" in status_text or "CUMPLE" in status_text:
        return SUCCESS
    if "RECHAZ" in status_text or "CANCEL" in status_text or "FUGA" in status_text or "RUPTURA" in status_text or "NO CUMPLE" in status_text:
        return DANGER
    if "PEND" in status_text or "PROCES" in status_text or "CUARENTENA" in status_text:
        return WARNING
    return MUTED


# ── Estilos de párrafo (reutilizados en todas las tablas/celdas) ──────────

def _style(name, size=8.4, leading=None, color=INK, bold=False, italic=False, align=TA_LEFT, upper=False, space_after=0):
    font = FONT_BOLD if bold else (FONT_IT if italic else FONT)
    return ParagraphStyle(
        name, fontName=font, fontSize=size, leading=leading or size * 1.28,
        textColor=color, alignment=align, spaceAfter=space_after,
    )


S_DOC_TITLE = _style("doc_title", size=13.5, color=NAVY, bold=True, align=TA_CENTER)
S_COMPANY = _style("company", size=12, color=NAVY, bold=True)
S_SUBTITLE = _style("subtitle", size=7.6, color=MUTED)
S_META_R = _style("meta_r", size=7.4, color=MUTED, align=TA_RIGHT)
S_LABEL = _style("label", size=6.6, color=MUTED, bold=True)
S_VALUE = _style("value", size=8.6, color=INK)
S_SECTION = _style("section", size=9.6, color=NAVY, bold=True)
S_BODY = _style("body", size=8.2, color=INK)
S_BODY_MUTED = _style("body_muted", size=7.4, color=MUTED)
S_BODY_BOLD = _style("body_bold", size=8.2, color=INK, bold=True)
S_TH = _style("th", size=7, color=NAVY, bold=True)
S_TH_C = _style("th_c", size=7, color=NAVY, bold=True, align=TA_CENTER)
S_TD = _style("td", size=7.6, color=INK)
S_TD_C = _style("td_c", size=7.6, color=INK, align=TA_CENTER)
S_TD_MUTED = _style("td_muted", size=7, color=MUTED)
S_SIGN_NAME = _style("sign_name", size=8, color=NAVY, bold=True)
S_SIGN_ROLE = _style("sign_role", size=6.8, color=MUTED)
S_EMPTY = _style("empty", size=8.2, color=MUTED, italic=True)
S_COVER_TITLE = _style("cover_title", size=19, color=NAVY, bold=True, align=TA_CENTER)
S_COVER_SUB = _style("cover_sub", size=12.5, color=MUTED, align=TA_CENTER)
S_COVER_LINE = _style("cover_line", size=10.5, color=INK, align=TA_CENTER, leading=16)
S_COVER_MUTED = _style("cover_muted", size=8.5, color=MUTED, align=TA_CENTER)


def P(text, style=S_BODY):
    return Paragraph(_safe(text, "").replace("\n", "<br/>"), style)


def _status_style(text, base_size=7.6, bold=True):
    return _style(f"status_{id(text)}", size=base_size, color=_status_color(text), bold=bold)


def Pstatus(text, size=7.6):
    return Paragraph(_safe(text, "-"), _status_style(text, size))


# ── Encabezado / pie de página (dibujados por el PageTemplate en cada hoja) ─

def _document_meta(canv, doc):
    """Encabezado en caja (logo + empresa + código/versión/fecha) idéntico en
    toda hoja del documento, y pie de página con generador/estado/número."""
    canv.saveState()
    x0, x1 = MARGIN, PAGE_W - MARGIN
    top = PAGE_H - 14 * mm

    if os.path.exists(LOGO_PATH):
        try:
            canv.drawImage(LOGO_PATH, x0, top - 9 * mm, width=9 * mm, height=9 * mm, preserveAspectRatio=True, mask="auto")
            text_x = x0 + 11 * mm
        except Exception:
            text_x = x0
    else:
        text_x = x0

    canv.setFillColor(NAVY)
    canv.setFont(FONT_BOLD, 11)
    canv.drawString(text_x, top - 3.2 * mm, COMPANY_NAME)
    canv.setFillColor(MUTED)
    canv.setFont(FONT, 7.4)
    canv.drawString(text_x, top - 7.6 * mm, "Gestión de Producción y Calidad")

    canv.setFont(FONT, 7.2)
    canv.drawRightString(x1, top - 2.4 * mm, f"Código: {doc.doc_code}")
    canv.drawRightString(x1, top - 6.4 * mm, f"Versión: {doc.doc_version}")
    canv.drawRightString(x1, top - 10.4 * mm, f"Generado: {_datetime(timezone.now())}")

    rule_y = top - 12.5 * mm
    canv.setStrokeColor(NAVY)
    canv.setLineWidth(1.1)
    canv.line(x0, rule_y, x1, rule_y)

    canv.setFont(FONT, 6.6)
    canv.setFillColor(MUTED)
    canv.drawString(x0, 10 * mm, f"Generado por: {doc.footer_generated_by}")
    canv.drawCentredString((x0 + x1) / 2, 10 * mm, f"Estado del documento: {doc.footer_status}")
    canv.drawRightString(x1, 10 * mm, f"Página {canv.getPageNumber()}")
    canv.setStrokeColor(GRID)
    canv.setLineWidth(0.5)
    canv.line(x0, 13 * mm, x1, 13 * mm)
    canv.restoreState()


class _ReportDoc(BaseDocTemplate):
    """BaseDocTemplate con un único frame de contenido bajo el encabezado fijo,
    reutilizado por todos los render_*_pdf de este módulo."""

    def __init__(self, buffer, *, doc_code, doc_version="1.0", footer_generated_by="-", footer_status="-", **kwargs):
        self.doc_code = doc_code
        self.doc_version = doc_version
        self.footer_generated_by = footer_generated_by
        self.footer_status = footer_status
        super().__init__(buffer, pagesize=PAGE_SIZE, leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=26 * mm, bottomMargin=16 * mm, **kwargs)
        frame = Frame(MARGIN, 16 * mm, CONTENT_W, PAGE_H - 26 * mm - 16 * mm, id="content")
        self.addPageTemplates([PageTemplate(id="doc", frames=[frame], onPage=_document_meta)])


def _build(buffer, story, **doc_kwargs):
    doc = _ReportDoc(buffer, **doc_kwargs)
    doc.build(story)


# ── Bloques reutilizables ──────────────────────────────────────────────────

def title_block(title, batch, extra_fields=None):
    """Título del documento + franja de identificación (producto/lote/OP/estado)."""
    order = batch.production_order
    product_name = order.output_item.name if order.output_item_id else "-"
    fields = [
        ("PRODUCTO", product_name),
        ("LOTE", order.batch_code or "-"),
        ("ORDEN DE PRODUCCIÓN", order.number),
        ("ESTADO DEL LOTE", batch.get_status_display()),
    ]
    if extra_fields:
        fields = fields + extra_fields
    story = [Paragraph(title.upper(), S_DOC_TITLE), Spacer(1, 8)]
    story.append(field_grid(fields, col_count=len(fields) if len(fields) <= 4 else 3))
    story.append(Spacer(1, 10))
    return story


def field_grid(pairs, col_count=2, col_widths=None):
    """Grilla de pares etiqueta/valor sin bordes (metadatos), en filas de
    `col_count` columnas. Usada para encabezados de sección tipo formulario."""
    pairs = [p for p in pairs if p[0] is not None]
    rows = []
    for i in range(0, len(pairs), col_count):
        chunk = pairs[i:i + col_count]
        label_row = [P(label.upper(), S_LABEL) for label, _ in chunk]
        value_row = [P(value, S_VALUE) for _, value in chunk]
        while len(label_row) < col_count:
            label_row.append("")
            value_row.append("")
        rows.append(label_row)
        rows.append(value_row)
    if not rows:
        return Spacer(1, 0)
    widths = col_widths or [CONTENT_W / col_count] * col_count
    table = Table(rows, colWidths=widths, hAlign="LEFT")
    style = [
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    for r in range(1, len(rows), 2):
        style.append(("BOTTOMPADDING", (0, r), (-1, r), 7))
    table.setStyle(TableStyle(style))
    return table


def section_title(text):
    tbl = Table([[P(text.upper(), S_SECTION)]], colWidths=[CONTENT_W])
    tbl.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 1, NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return tbl


def data_table(headers, rows, col_widths, align=None, header_align="LEFT"):
    """Tabla de datos con rejilla completa (bordes en todas las celdas) y
    encabezado sombreado — el mismo lenguaje visual de los formatos PRD-FR-*
    impresos, no una tabla "flotante" sin bordes."""
    header_style = S_TH_C if header_align == "CENTER" else S_TH
    header_row = [Paragraph(h.upper(), header_style) for h in headers]
    body_rows = []
    for row in rows:
        cells = []
        for value in row:
            if isinstance(value, (Paragraph, Table)):
                cells.append(value)
            else:
                cells.append(P(str(value), S_TD))
        body_rows.append(cells)
    if not body_rows:
        body_rows = [[P("Sin registros.", S_EMPTY)] + ["" for _ in headers[1:]]]
    table = Table([header_row] + body_rows, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("GRID", (0, 0), (-1, -1), 0.6, GRID),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(1, len(body_rows) + 1):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA_BG))
    if align:
        for col, a in align.items():
            style.append(("ALIGN", (col, 0), (col, -1), a))
    table.setStyle(TableStyle(style))
    return table


def _signature_cell(label, sig_name, sig_role, image_path_or_field, max_w=46 * mm, max_h=15 * mm):
    cell = []
    img = _load_image_flowable(image_path_or_field, max_w, max_h)
    if img is not None:
        cell.append(img)
    else:
        cell.append(Spacer(1, max_h))
    cell.append(Spacer(1, 2))
    line_tbl = Table([[""]], colWidths=[max_w])
    line_tbl.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, -1), 0.7, RULE)]))
    cell.append(line_tbl)
    cell.append(Spacer(1, 2))
    cell.append(P(sig_name.upper() if sig_name else "SIN FIRMA", S_SIGN_NAME))
    cell.append(P(label, S_SIGN_ROLE))
    if sig_role:
        cell.append(P(sig_role, S_SIGN_ROLE))
    return cell


def _load_image_flowable(field, max_w, max_h):
    if not field:
        return None
    try:
        if not field.storage.exists(field.name):
            return None
        with field.open("rb") as fobj:
            data = fobj.read()
        from reportlab.lib.utils import ImageReader
        reader = ImageReader(io.BytesIO(data))
        iw, ih = reader.getSize()
        draw_w, draw_h = max_w, max_w * (ih / iw) if iw else max_h
        if draw_h > max_h:
            draw_h, draw_w = max_h, max_h * (iw / ih) if ih else max_w
        return Image(io.BytesIO(data), width=draw_w, height=draw_h)
    except Exception:
        return None


def signature_block_row(entries):
    """Fila de 1-2 bloques de firma lado a lado, cada uno reservando su
    propio espacio (nombre, cargo, imagen) — reemplaza el dibujo manual que
    causaba solapamientos con el texto anterior."""
    cols = [_signature_cell(role, name, sub, image) for role, name, sub, image in entries]
    col_w = CONTENT_W / len(cols)
    table = Table([cols], colWidths=[col_w] * len(cols), hAlign="LEFT")
    table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return KeepTogether([Spacer(1, 6), table])


def generic_signatures_block(instance):
    """Bloque de firmas para el modelo genérico Signature (GenericRelation)."""
    signatures = list(instance.signatures.all()) if hasattr(instance, "signatures") else []
    replaced_ids = {sig.replaced_by_id for sig in signatures if sig.replaced_by_id}
    current = [sig for sig in signatures if sig.id not in replaced_ids]
    responsible = next((sig for sig in current if sig.role == "RESPONSIBLE"), None)
    verifier = next((sig for sig in current if sig.role == "VERIFIER"), None)

    def entry(sig, label):
        if sig is None:
            return (label, None, None, None)
        return (f"{label} · {_datetime(sig.created_at)}", sig.full_name, None, sig.image)

    return signature_block_row([entry(responsible, "Responsable"), entry(verifier, "Verificador")])


def observations_block(text, title="Observaciones"):
    if not text:
        return []
    return [Spacer(1, 6), section_title(title), Spacer(1, 4), P(text, S_BODY), Spacer(1, 6)]


def empty_note(text):
    return P(text, S_EMPTY)


# ── Documentos individuales ──────────────────────────────────────────────────

def render_line_clearance_pdf(clearance):
    batch = clearance.batch
    buffer = io.BytesIO()
    story = title_block("Despeje de línea de áreas y equipos", batch, [
        ("FASE", clearance.get_phase_display()),
        ("ESTADO", clearance.get_status_display()),
        ("ÁREA", clearance.area.name if clearance.area else "-"),
        ("LÍNEA", clearance.production_line.name if clearance.production_line else "-"),
        ("PRODUCTO ANTERIOR", clearance.previous_product or "-"),
        ("LOTE ANTERIOR", clearance.previous_batch_code or "-"),
        ("FECHA DE LIBERACIÓN", _datetime(clearance.cleared_at)),
        ("REALIZADO POR", _employee_name(clearance.performed_by)),
    ])
    story.append(section_title("Checklist de verificación"))
    story.append(Spacer(1, 4))
    rows = []
    for criterion in clearance.criteria.all():
        obs = f"Obs: {criterion.observation}" if criterion.observation else ""
        rows.append([P(criterion.get_criterion_display(), S_TD), Pstatus(criterion.get_result_display()), P(obs, S_TD_MUTED)])
    story.append(data_table(["Criterio", "Resultado", "Observación"], rows, [CONTENT_W * 0.44, CONTENT_W * 0.16, CONTENT_W * 0.40]))
    story.append(signature_block_row([
        ("Verificador de liberación", _employee_name(clearance.verified_by), None, clearance.verifier_signature),
    ]))
    _build(
        buffer, story, doc_code="PRD-FR-002",
        footer_generated_by=_employee_name(clearance.verified_by), footer_status=clearance.get_status_display(),
    )
    buffer.seek(0)
    return buffer


def render_dispensing_order_pdf(order):
    batch = order.batch
    buffer = io.BytesIO()
    story = title_block("Orden de dispensación y fabricación", batch, [
        ("ESTADO", order.get_status_display()),
        ("FECHA DE EMISIÓN", _date(order.issued_at)),
        ("RESPONSABLE", _employee_name(order.responsible)),
        ("VERIFICADOR", _employee_name(order.verifier)),
    ])
    story.append(section_title("Detalle por materia prima"))
    story.append(Spacer(1, 4))
    headers = ["#", "Materia prima", "Lote MP", "Teórica", "Pesada", "Desv. %", "Estado"]
    widths = [0.05, 0.30, 0.15, 0.13, 0.13, 0.10, 0.14]
    widths = [CONTENT_W * w for w in widths]
    rows = []
    for line in order.lines.all().order_by("sequence"):
        deviation = line.deviation_percentage
        rows.append([
            str(line.sequence), line.item.name,
            line.raw_material_batch.supplier_batch_code if line.raw_material_batch_id else "-",
            f"{line.theoretical_quantity:.3f}",
            f"{line.net_weight:.3f}" if line.net_weight is not None else "-",
            f"{deviation:.2f}" if deviation is not None else "-",
            Pstatus(line.get_status_display()),
        ])
    story.append(data_table(headers, rows, widths, align={0: "CENTER", 3: "RIGHT", 4: "RIGHT", 5: "RIGHT"}))
    story.append(signature_block_row([
        ("Responsable de dispensación", _employee_name(order.responsible), None, order.responsible_signature),
        ("Verificador de dispensación", _employee_name(order.verifier), None, order.verifier_signature),
    ]))
    _build(
        buffer, story, doc_code="PRD-FR-003",
        footer_generated_by=_employee_name(order.responsible), footer_status=order.get_status_display(),
    )
    buffer.seek(0)
    return buffer


def render_analysis_certificate_pdf(certificate):
    batch = certificate.batch
    buffer = io.BytesIO()
    story = title_block("Certificado de análisis", batch, [
        ("FECHA DE FABRICACIÓN", _date(certificate.manufactured_at)),
        ("FECHA DE MUESTREO", _date(certificate.sampled_at)),
        ("FECHA DE ANÁLISIS", _date(certificate.analyzed_at)),
        ("CONCEPTO", certificate.get_concept_display()),
        ("ANALIZADO POR", _employee_name(certificate.analyzed_by)),
        ("VERIFICADO POR", _employee_name(certificate.verified_by)),
    ])
    story.append(section_title("Ensayos"))
    story.append(Spacer(1, 4))
    headers = ["Ensayo", "Especificación", "Result. granel", "Result. terminado", "Cumple"]
    widths = [0.24, 0.30, 0.18, 0.18, 0.10]
    widths = [CONTENT_W * w for w in widths]
    rows = []
    for test in certificate.tests.all():
        complies_label = "Cumple" if test.complies else "No cumple" if test.complies is False else "-"
        rows.append([test.name, test.specification, test.bulk_result or "-", test.finished_product_result or "-", Pstatus(complies_label)])
    story.append(data_table(headers, rows, widths))
    story.append(signature_block_row([
        ("Analista", _employee_name(certificate.analyzed_by), None, None),
        ("Verificador de calidad", _employee_name(certificate.verified_by), None, None),
    ]))
    _build(
        buffer, story, doc_code="PRD-FR-005",
        footer_generated_by=_employee_name(certificate.analyzed_by), footer_status=certificate.get_concept_display(),
    )
    buffer.seek(0)
    return buffer


def render_batch_release_pdf(release):
    batch = release.batch
    buffer = io.BytesIO()
    story = title_block("Liberación de producto terminado", batch, [
        ("CANTIDAD LIBERADA", str(release.released_quantity)),
        ("CANTIDAD RETENIDA", str(release.retained_quantity)),
        ("CANTIDAD RECHAZADA", str(release.rejected_quantity)),
        ("CONDICIÓN", release.get_condition_display()),
        ("FECHA DE LIBERACIÓN", _datetime(release.released_at)),
        ("BODEGA DESTINO", release.warehouse_location.name if release.warehouse_location_id else "-"),
    ])
    story.extend(observations_block(release.observations))
    story.append(signature_block_row([
        ("Liberado por Calidad", _employee_name(release.released_by_quality), None, release.quality_signature),
        ("Aprobado por Director Técnico", _employee_name(release.approved_by_technical_director), None, release.technical_director_signature),
    ]))
    _build(
        buffer, story, doc_code="MFG-REL",
        footer_generated_by=_employee_name(release.released_by_quality), footer_status=release.get_condition_display(),
    )
    buffer.seek(0)
    return buffer


def render_document_checklist_pdf(batch):
    buffer = io.BytesIO()
    items = list(batch.document_checklist.all().order_by("document_code"))
    total = len(items)
    approved = sum(1 for item in items if item.status == item.Status.APPROVED)
    pending = sum(1 for item in items if item.status in (item.Status.PENDING, item.Status.IN_PROGRESS))
    rejected = sum(1 for item in items if item.status == item.Status.REJECTED)
    not_applicable = sum(1 for item in items if not item.applies)
    percentage = round((approved / total) * 100) if total else 0

    story = title_block("Verificación de documentos", batch, [
        ("TOTAL DOCUMENTOS", str(total)), ("COMPLETADOS", str(approved)), ("PENDIENTES", str(pending)),
        ("RECHAZADOS", str(rejected)), ("NO APLICAN", str(not_applicable)), ("% EXPEDIENTE", f"{percentage}%"),
    ])
    story.append(section_title("Documentos del expediente"))
    story.append(Spacer(1, 4))
    rows = [[item.name, Pstatus(item.get_status_display()), item.get_result_display()] for item in items]
    story.append(data_table(["Documento", "Estado", "Resultado"], rows, [CONTENT_W * 0.55, CONTENT_W * 0.25, CONTENT_W * 0.20]))
    _build(buffer, story, doc_code="PRD-FR-001", footer_status=f"{percentage}%")
    buffer.seek(0)
    return buffer


def render_raw_material_identification_pdf(dispensing_line):
    batch = dispensing_line.order.batch
    buffer = io.BytesIO()
    raw_batch = dispensing_line.raw_material_batch
    story = title_block("Identificación de materia prima dispensada", batch, [
        ("CÓDIGO DE MATERIA PRIMA", dispensing_line.item.code if dispensing_line.item_id else "-"),
        ("NOMBRE DE MATERIA PRIMA", dispensing_line.item.name if dispensing_line.item_id else "-"),
        ("LOTE DE MATERIA PRIMA", raw_batch.supplier_batch_code if raw_batch else "-"),
        ("N.º DE ANÁLISIS", raw_batch.analysis_number if raw_batch else "-"),
        ("FECHA DE VENCIMIENTO", _date(raw_batch.expires_at) if raw_batch else "-"),
        ("ESTADO DE CALIDAD", raw_batch.get_quality_status_display() if raw_batch else "-"),
        ("TARA", str(dispensing_line.tare) if dispensing_line.tare is not None else "-"),
        ("PESO BRUTO", str(dispensing_line.gross_weight) if dispensing_line.gross_weight is not None else "-"),
        ("PESO NETO", str(dispensing_line.net_weight) if dispensing_line.net_weight is not None else "-"),
        ("RECIPIENTE", dispensing_line.container or "-"),
        ("PESADO POR", _employee_name(dispensing_line.weighed_by)),
        ("VERIFICADO POR", _employee_name(dispensing_line.verified_by)),
        ("FECHA Y HORA DE PESADA", _datetime(dispensing_line.weighed_at)),
    ])
    prints = list(dispensing_line.identification_prints.order_by("-printed_at"))
    if prints:
        story.append(section_title("Historial de impresión"))
        story.append(Spacer(1, 4))
        rows = []
        for entry in prints:
            label = "Reimpresión" if entry.is_reprint else "Impresión original"
            motivo = entry.reprint_reason if entry.is_reprint and entry.reprint_reason else "-"
            rows.append([label, _datetime(entry.printed_at), str(entry.printed_by), motivo])
        story.append(data_table(["Tipo", "Fecha y hora", "Impreso por", "Motivo"], rows,
                                 [CONTENT_W * 0.22, CONTENT_W * 0.24, CONTENT_W * 0.24, CONTENT_W * 0.30]))
    _build(buffer, story, doc_code="PRD-FR-007", footer_status=dispensing_line.get_status_display())
    buffer.seek(0)
    return buffer


def render_line_identification_pdf(line_identification):
    batch = line_identification.batch
    order = batch.production_order
    buffer = io.BytesIO()
    story = title_block("Identificación de línea", batch, [
        ("CANTIDAD", str(order.planned_quantity)),
        ("ÁREA", line_identification.area.name if line_identification.area else "-"),
        ("LÍNEA", line_identification.production_line.name if line_identification.production_line else "-"),
        ("COLOCADA", _datetime(line_identification.placed_at)),
        ("COLOCADA POR", _employee_name(line_identification.placed_by)),
        ("RETIRADA", _datetime(line_identification.removed_at)),
        ("RETIRADA POR", _employee_name(line_identification.removed_by)),
    ])
    story.append(generic_signatures_block(line_identification))
    _build(buffer, story, doc_code="PRD-FR-009", footer_generated_by=_employee_name(line_identification.placed_by))
    buffer.seek(0)
    return buffer


def render_cleaning_record_pdf(record):
    batch = record.batch
    buffer = io.BytesIO()
    story = title_block("Verificación de limpieza y buen estado de equipos", batch, [
        ("TIPO", record.get_record_type_display()),
        ("FASE DEL PROCESO", record.get_phase_display() if record.phase else "-"),
        ("ÁREA", record.area or "-"),
        ("EQUIPO", record.equipment or "-"),
        ("CÓDIGO DEL EQUIPO", record.equipment_code or "-"),
        ("FECHA Y HORA DE LIMPIEZA", _datetime(record.cleaned_at)),
        ("PRODUCTO ANTERIOR", record.previous_product or "-"),
        ("LOTE ANTERIOR", record.previous_batch_code or "-"),
        ("MÉTODO DE LIMPIEZA", record.cleaning_method or "-"),
        ("SANITIZANTE", record.sanitizer or "-"),
        ("CONCENTRACIÓN", record.sanitizer_concentration or "-"),
        ("LOTE DEL SANITIZANTE", record.sanitizer_batch or "-"),
        ("VENCIMIENTO DEL SANITIZANTE", _date(record.sanitizer_expires_at)),
        ("RESULTADO", record.get_result_display() if record.result else "-"),
        ("VIGENCIA DE LA LIMPIEZA", _datetime(record.valid_until)),
        ("VENCIDA", "Sí" if record.is_expired else "No"),
    ], )
    story.extend(observations_block(record.observations))
    story.append(generic_signatures_block(record))
    _build(
        buffer, story, doc_code="PRD-FR-021",
        footer_generated_by=_employee_name(record.performed_by),
        footer_status=record.get_result_display() if record.result else "-",
    )
    buffer.seek(0)
    return buffer


def render_manufacturing_steps_pdf(batch):
    buffer = io.BytesIO()
    story = title_block("Instrucciones de fabricación", batch)
    for execution in batch.step_executions.select_related("step").order_by("step__sequence"):
        step = execution.step
        block = [
            Table([[P(f"Paso {step.sequence}. {step.phase or '-'}", S_BODY_BOLD), Pstatus(execution.get_status_display())]],
                  colWidths=[CONTENT_W * 0.75, CONTENT_W * 0.25],
                  style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                     ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                                     ("ALIGN", (1, 0), (1, 0), "RIGHT")])),
            P(step.instruction, S_BODY_MUTED),
            Spacer(1, 4),
            field_grid([
                ("EQUIPO", step.required_equipment or "-"),
                ("TEMP. OBJETIVO/REAL", f"{step.target_temperature or '-'} / {execution.actual_temperature or '-'}"),
                ("TIEMPO OBJETIVO/REAL (MIN)", f"{step.target_time_minutes or '-'} / {execution.actual_time_minutes or '-'}"),
                ("PH OBJETIVO/REAL", f"{step.target_ph or '-'} / {execution.actual_ph or '-'}"),
                ("VELOCIDAD AGITACIÓN", execution.actual_agitation_speed or step.target_agitation_speed or "-"),
                ("PRESIÓN", execution.actual_pressure or step.target_pressure or "-"),
                ("REALIZADO POR", _employee_name(execution.performed_by)),
                ("VERIFICADO POR", _employee_name(execution.verified_by)),
                ("INICIO", _datetime(execution.started_at)),
                ("FIN", _datetime(execution.finished_at)),
            ], col_count=2),
        ]
        if execution.deviation:
            block.append(P(f"Desviación: {execution.deviation}", _style("dev", size=7.6, color=DANGER)))
        block.append(generic_signatures_block(execution))
        block.append(Spacer(1, 10))
        block.append(Table([[""]], colWidths=[CONTENT_W], style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, GRID)])))
        block.append(Spacer(1, 10))
        story.append(KeepTogether(block))
    _build(buffer, story, doc_code="PRD-FR-004")
    buffer.seek(0)
    return buffer


def render_production_control_pdf(control):
    batch = control.batch
    buffer = io.BytesIO()
    story = title_block("Formato de control de producción", batch, [
        ("TAMAÑO DEL LOTE", str(control.lot_size or "-")),
        ("UNIDAD", control.unit.abbreviation if control.unit_id else "-"),
    ])
    story.append(section_title("Solicitud y conciliación de materiales de acondicionamiento"))
    story.append(Spacer(1, 4))
    headers = ["Material", "Solicit.", "Entreg.", "Devuelto", "Adicional", "Buenas", "Malas proc.", "Malas fáb.", "Dif."]
    ws = [0.24, 0.09, 0.09, 0.10, 0.10, 0.10, 0.10, 0.10, 0.08]
    widths = [CONTENT_W * w for w in ws]
    rows = []
    for material in control.materials.all():
        diff = material.reconciliation_difference
        diff_style = _style("diff", size=7.6, color=(WARNING if diff != 0 else INK))
        rows.append([
            material.item.name, str(material.requested_quantity), str(material.delivered_quantity),
            str(material.returned_quantity), str(material.additional_quantity), str(material.good_units),
            str(material.process_rejects), str(material.factory_rejects), Paragraph(str(diff), diff_style),
        ])
    story.append(data_table(headers, rows, widths, align={i: "RIGHT" for i in range(1, 9)}))
    story.append(generic_signatures_block(control))
    _build(buffer, story, doc_code="PRD-FR-008")
    buffer.seek(0)
    return buffer


def render_filling_control_pdf(control):
    batch = control.batch
    buffer = io.BytesIO()
    story = title_block("Control de llenado", batch, [
        ("LÍNEA", control.production_line.name if control.production_line else "-"),
        ("EQUIPO", control.equipment or "-"),
        ("TANQUE DE ORIGEN", control.source_tank or "-"),
        ("INICIO", _datetime(control.started_at)),
        ("FIN", _datetime(control.finished_at)),
        ("RESPONSABLE", _employee_name(control.responsible)),
        ("VERIFICADOR", _employee_name(control.verifier)),
        ("CANTIDAD PROGRAMADA", str(control.planned_quantity or "-")),
        ("CANTIDAD PRODUCIDA", str(control.produced_quantity)),
        ("CANTIDAD RECHAZADA", str(control.rejected_quantity)),
        ("CANTIDAD RECUPERADA", str(control.recovered_quantity)),
        ("RENDIMIENTO", f"{control.yield_percentage:.1f}%" if control.yield_percentage is not None else "-"),
    ], )
    participants = list(control.participants.all())
    if participants:
        story.append(section_title("Personal que interviene en el proceso"))
        story.append(Spacer(1, 4))
        rows = [[p.activity or p.role, _employee_name(p.employee), _datetime(p.check_in), _datetime(p.check_out)] for p in participants]
        story.append(data_table(["Actividad", "Empleado", "Ingreso", "Salida"], rows,
                                 [CONTENT_W * 0.28, CONTENT_W * 0.30, CONTENT_W * 0.21, CONTENT_W * 0.21]))
        story.append(Spacer(1, 8))
    log_entries = list(control.log_entries.all())
    if log_entries:
        story.append(section_title("Control de empaque (registro periódico)"))
        story.append(Spacer(1, 4))
        rows = []
        for entry in log_entries:
            motivo = entry.rejection_reason or "-"
            rows.append([_datetime(entry.recorded_at), str(entry.units_produced), str(entry.displays), str(entry.boxes),
                         str(entry.units_rejected), motivo])
        story.append(data_table(["Fecha", "Producidas", "Displays", "Cajas", "Rechazadas", "Motivo"], rows,
                                 [CONTENT_W * 0.22, CONTENT_W * 0.14, CONTENT_W * 0.13, CONTENT_W * 0.11, CONTENT_W * 0.14, CONTENT_W * 0.26],
                                 align={1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"}))
        story.append(Spacer(1, 8))
    story.append(generic_signatures_block(control))
    _build(buffer, story, doc_code="PRD-FR-021", footer_generated_by=_employee_name(control.responsible))
    buffer.seek(0)
    return buffer


def render_weight_volume_control_pdf(control):
    batch = control.batch
    buffer = io.BytesIO()
    story = title_block("Control de peso y/o volumen", batch, [
        ("TARA", str(control.tare or "-")),
        ("LÍMITE INFERIOR", str(control.lower_limit or "-")),
        ("LÍMITE SUPERIOR", str(control.upper_limit or "-")),
        ("UNIDAD", control.unit.abbreviation if control.unit_id else "-"),
        ("RESULTADO GENERAL", control.get_overall_result_display()),
        ("AUTORIZÓ REANUDACIÓN", _employee_name(control.resumed_authorized_by) if control.resumed_authorized_by_id else "-"),
    ])
    samples = list(control.samples.all())
    net_values = [float(s.net_weight) for s in samples if s.net_weight is not None]
    if net_values:
        average = sum(net_values) / len(net_values)
        minimum, maximum = min(net_values), max(net_values)
        out_of_spec = sum(1 for s in samples if s.result == "NO")
        pct = round((out_of_spec / len(samples)) * 100) if samples else 0
        story.append(field_grid([
            ("PROMEDIO", f"{average:.3f}"), ("MÍNIMO", f"{minimum:.3f}"), ("MÁXIMO", f"{maximum:.3f}"),
            ("% FUERA DE ESPECIFICACIÓN", f"{pct}%"),
        ], col_count=4))
        story.append(Spacer(1, 8))
    story.append(section_title("Muestras"))
    story.append(Spacer(1, 4))
    rows = []
    for sample in samples:
        obs = f"Ajuste: {sample.adjustment_made}" if sample.adjustment_made else ""
        rows.append([
            str(sample.sample_number), str(sample.gross_weight or "-"), str(sample.tare or "-"),
            str(sample.net_weight if sample.net_weight is not None else "-"), str(sample.volume or "-"),
            Pstatus(sample.get_result_display()), P(obs, S_TD_MUTED),
        ])
    story.append(data_table(["Muestra", "Bruto", "Tara", "Neto", "Vol.", "Resultado", "Observación"], rows,
                             [CONTENT_W * 0.08, CONTENT_W * 0.12, CONTENT_W * 0.12, CONTENT_W * 0.12, CONTENT_W * 0.10, CONTENT_W * 0.16, CONTENT_W * 0.30],
                             align={0: "CENTER", 1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"}))
    story.append(generic_signatures_block(control))
    _build(buffer, story, doc_code="PRD-FR-023", footer_status=control.get_overall_result_display())
    buffer.seek(0)
    return buffer


def render_seal_integrity_control_pdf(control):
    batch = control.batch
    buffer = io.BytesIO()
    story = title_block("Control de hermeticidad", batch, [
        ("EQUIPO", control.equipment or "-"),
        ("CÓDIGO DEL EQUIPO", control.equipment_code or "-"),
        ("FECHA Y HORA", _datetime(control.tested_at)),
        ("PRESIÓN (BAR)", str(control.pressure_bar or "-")),
        ("TIEMPO (S)", str(control.time_seconds or "-")),
        ("RESULTADO GENERAL", control.get_overall_result_display()),
    ])
    story.append(section_title("Muestras"))
    story.append(Spacer(1, 4))
    rows = [[str(s.sample_number), Pstatus(s.get_result_display()), P(s.observation or "", S_TD_MUTED)] for s in control.samples.all()]
    story.append(data_table(["Muestra", "Resultado", "Observación"], rows,
                             [CONTENT_W * 0.14, CONTENT_W * 0.20, CONTENT_W * 0.66], align={0: "CENTER"}))
    story.extend(observations_block(control.observations))
    story.append(generic_signatures_block(control))
    _build(buffer, story, doc_code="PRD-FR-006", footer_status=control.get_overall_result_display())
    buffer.seek(0)
    return buffer


def render_packaging_control_pdf(control):
    batch = control.batch
    buffer = io.BytesIO()
    story = title_block("Control de acondicionamiento", batch)
    story.append(section_title("Etiqueta testigo"))
    story.append(Spacer(1, 4))
    label_fields = [
        ("CÓDIGO DE ETIQUETA", control.label_code or "-"),
        ("VERSIÓN DEL ARTE", control.artwork_version or "-"),
        ("LOTE DEL MATERIAL", control.label_material_batch or "-"),
        ("RESULTADO", control.get_label_result_display() if control.label_result else "-"),
        ("REALIZADO POR", _employee_name(control.label_performed_by)),
        ("VERIFICADO POR", _employee_name(control.label_verified_by)),
    ]
    img = _load_image_flowable(control.label_sample_file, 55 * mm, 32 * mm) if control.label_sample_file else None
    left = field_grid(label_fields, col_count=2, col_widths=[CONTENT_W * 0.35] * 2)
    right = [img] if img else [P("Sin foto.", _style("no_photo3", size=8.2, color=MUTED, italic=True, align=TA_CENTER))]
    story.append(Table([[left, right]], colWidths=[CONTENT_W * 0.68, CONTENT_W * 0.32],
                        style=TableStyle([("VALIGN", (0, 0), (0, 0), "TOP"), ("VALIGN", (1, 0), (1, 0), "MIDDLE"),
                                           ("LEFTPADDING", (0, 0), (-1, -1), 0)])))
    story.append(Spacer(1, 10))

    story.append(section_title("Loteado inicial y final"))
    story.append(Spacer(1, 4))
    markings = list(control.lot_markings.all().order_by("created_at"))
    for marking in markings:
        stage_label = "Loteado inicial" if marking.stage == "INITIAL" else "Loteado final"
        meta = field_grid([
            ("LOTE IMPRESO", marking.printed_batch_code or "-"),
            ("FABRICACIÓN", _date(marking.manufacture_date)),
            ("VENCE", _date(marking.expiry_date)),
            ("LEGIBLE", "Sí" if marking.is_legible else "No" if marking.is_legible is False else "-"),
            ("UBICACIÓN CORRECTA", "Sí" if marking.is_correctly_placed else "No" if marking.is_correctly_placed is False else "-"),
            ("REALIZADO / VERIFICADO", f"{_employee_name(marking.performed_by)} / {_employee_name(marking.verified_by)}"),
        ], col_count=3, col_widths=[CONTENT_W * 0.68 / 3] * 3)
        header = Table([[P(stage_label, S_BODY_BOLD), Pstatus(marking.get_result_display() if marking.result else "-")]],
                        colWidths=[CONTENT_W * 0.68 * 0.7, CONTENT_W * 0.68 * 0.3],
                        style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("ALIGN", (1, 0), (1, 0), "RIGHT")]))
        left_block = [header, Spacer(1, 3), meta]
        img = _load_image_flowable(marking.photo, CONTENT_W * 0.28, 28 * mm) if marking.photo else None
        right_block = [img] if img else [P("Sin foto.", _style("no_photo2", size=8.2, color=MUTED, italic=True, align=TA_CENTER))]
        row = Table([[left_block, right_block]], colWidths=[CONTENT_W * 0.68, CONTENT_W * 0.32],
                    style=TableStyle([("VALIGN", (0, 0), (0, 0), "TOP"), ("VALIGN", (1, 0), (1, 0), "MIDDLE"),
                                       ("LEFTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
        story.append(KeepTogether([row, Spacer(1, 4)]))
    if not markings:
        story.append(empty_note("Sin registros de loteado."))
    story.append(Spacer(1, 8))

    story.append(section_title("Conciliación de empaque"))
    story.append(Spacer(1, 4))
    story.append(field_grid([
        ("UNIDADES POR DISPLAY", str(control.units_per_display or "-")),
        ("DISPLAYS POR CAJA", str(control.displays_per_box or "-")),
        ("UNIDADES POR CAJA", str(control.units_per_box or "-")),
        ("CAJAS COMPLETAS", str(control.complete_boxes)),
        ("DISPLAYS INCOMPLETOS", str(control.incomplete_displays)),
        ("UNIDADES SUELTAS", str(control.loose_units)),
        ("TOTAL CONCILIADO", str(control.total_reconciled)),
        ("SALDOS", str(control.balances)),
        ("RECHAZOS", str(control.rejections)),
    ], col_count=3))
    story.extend(observations_block(control.rejection_reasons, title="Motivos de rechazo"))
    story.append(generic_signatures_block(control))
    _build(buffer, story, doc_code="PRD-FR-022", footer_generated_by=_employee_name(control.responsible))
    buffer.seek(0)
    return buffer


def render_microbiology_analysis_pdf(microbiology):
    batch = microbiology.batch
    buffer = io.BytesIO()
    story = title_block("Análisis microbiológico", batch, [
        ("CÓDIGO DE MUESTRA", microbiology.sample_code or "-"),
        ("TIPO DE MUESTRA", microbiology.sample_type or "-"),
        ("FECHA DE TOMA", _date(microbiology.taken_at)),
        ("TOMADA POR", _employee_name(microbiology.taken_by)),
        ("FECHA DE ENVÍO", _date(microbiology.sent_at)),
        ("LABORATORIO", microbiology.laboratory or "-"),
        ("N.º DE INFORME", microbiology.report_number or "-"),
        ("RESULTADO GENERAL", microbiology.get_overall_result_display()),
        ("FECHA DE APROBACIÓN", _date(microbiology.approved_at)),
        ("APROBADO POR", _employee_name(microbiology.approved_by)),
    ], )
    if microbiology.results:
        story.append(section_title("Resultados"))
        story.append(Spacer(1, 4))
        rows = []
        for result in microbiology.results:
            name = result.get("name", "-") if isinstance(result, dict) else str(result)
            value = result.get("value", "-") if isinstance(result, dict) else "-"
            rows.append([name, str(value)])
        story.append(data_table(["Ensayo", "Resultado"], rows, [CONTENT_W * 0.6, CONTENT_W * 0.4]))
        story.append(Spacer(1, 8))
    story.extend(observations_block(microbiology.observations))
    story.append(generic_signatures_block(microbiology))
    _build(
        buffer, story, doc_code="MFG-MICRO",
        footer_generated_by=_employee_name(microbiology.approved_by), footer_status=microbiology.get_overall_result_display(),
    )
    buffer.seek(0)
    return buffer


# ── Expediente completo del lote ─────────────────────────────────────────────
# Orden y contenido de las 16 secciones acordado con producción, replicando la
# secuencia real de los formatos físicos (PRD-FR-001 a PRD-FR-022):
#   1. Información general de la orden
#   2. Verificación documental
#   3. Formato de control de producción (solicitud y conciliación de materiales)
#   4. Identificación de línea
#   5. Verificación de limpieza de equipos — acondicionamiento y llenado
#   6. Despeje de línea de áreas y equipos — dispensación
#   7. Certificado de análisis (calidad, incluye microbiología)
#   8. Control de acondicionamiento (etiqueta testigo, loteado inicial/final)
#   9. Verificación de limpieza de equipos — dispensación y fabricación
#   10. Orden de dispensación
#   11. Instrucciones de fabricación
#   12. Control de llenado
#   13. Control de peso y/o volumen
#   14. Despeje de línea de áreas y equipos — fabricación/llenado/acondicionamiento
#   15. Control de hermeticidad
#   16. Identificación de materia prima dispensada
# Cierra con liberación final y anexos, que no forman parte de la numeración
# de planta pero deben quedar en el expediente para su archivo.

def _cover_page(batch):
    order = batch.production_order
    logo = None
    if os.path.exists(LOGO_PATH):
        try:
            logo = Image(LOGO_PATH, width=22 * mm, height=22 * mm)
        except Exception:
            logo = None
    story = [Spacer(1, 55 * mm)]
    if logo:
        logo.hAlign = "CENTER"
        story.append(logo)
        story.append(Spacer(1, 10))
    story.append(Paragraph(COMPANY_NAME, S_COVER_TITLE))
    story.append(Spacer(1, 6))
    story.append(Paragraph("EXPEDIENTE COMPLETO DE FABRICACIÓN DE LOTE", S_COVER_SUB))
    story.append(Spacer(1, 26))
    product_name = order.output_item.name if order.output_item_id else "-"
    story.append(Paragraph(f"Producto: {product_name}", S_COVER_LINE))
    story.append(Paragraph(f"Lote: {order.batch_code or '-'} &nbsp;·&nbsp; Orden de producción: {order.number}", S_COVER_LINE))
    status_style = _style("cover_status", size=11, color=_status_color(batch.get_status_display()), bold=True, align=TA_CENTER)
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Estado: {batch.get_status_display()}", status_style))
    story.append(Spacer(1, 30))
    story.append(Paragraph(f"Generado: {_datetime(timezone.now())}", S_COVER_MUTED))
    story.append(PageBreak())
    return story


def _numbered_section(number, title, doc_code_hint=""):
    return [Paragraph(f"{number}. {title}".upper(), S_DOC_TITLE), Spacer(1, 8)]


def _identity_row(batch):
    order = batch.production_order
    product_name = order.output_item.name if order.output_item_id else "-"
    return field_grid([
        ("PRODUCTO", product_name), ("LOTE", order.batch_code or "-"),
        ("ORDEN DE PRODUCCIÓN", order.number), ("ESTADO DEL LOTE", batch.get_status_display()),
    ], col_count=4)


def _cleaning_records_section(number, title, batch, phases):
    records = [r for r in batch.cleaning_records.all() if r.phase in phases]
    story = _numbered_section(number, title)
    story.append(_identity_row(batch))
    story.append(Spacer(1, 10))
    if not records:
        story.append(empty_note("Sin registros de limpieza para este alcance."))
        return story
    rows = []
    for record in records:
        detail = (
            f"Equipo: {record.equipment or '-'} ({record.equipment_code or '-'})<br/>"
            f"Producto anterior: {record.previous_product or '-'} (Lote {record.previous_batch_code or '-'})<br/>"
            f"Sanitizante: {record.sanitizer or '-'} {record.sanitizer_concentration or ''}<br/>"
            f"Realizado por: {_employee_name(record.performed_by)} · Verificado por: {_employee_name(record.verified_by)}"
        )
        rows.append([
            record.get_record_type_display(), record.area or record.equipment or "-",
            _datetime(record.cleaned_at), Pstatus(record.get_result_display() if record.result else "Pendiente"),
            P(detail, S_TD_MUTED),
        ])
    story.append(data_table(["Tipo", "Área/Equipo", "Fecha", "Resultado", "Detalle"], rows,
                             [CONTENT_W * 0.12, CONTENT_W * 0.16, CONTENT_W * 0.14, CONTENT_W * 0.13, CONTENT_W * 0.45]))
    return story


def _line_clearances_section(number, title, batch, phases):
    clearances = [c for c in batch.line_clearances.all() if c.phase in phases]
    story = _numbered_section(number, title)
    story.append(_identity_row(batch))
    story.append(Spacer(1, 10))
    if not clearances:
        story.append(empty_note("Sin despejes de línea para este alcance."))
        return story
    for clearance in clearances:
        header = Table([[P(f"{clearance.get_phase_display()}", S_BODY_BOLD), Pstatus(clearance.get_status_display())]],
                        colWidths=[CONTENT_W * 0.7, CONTENT_W * 0.3],
                        style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("ALIGN", (1, 0), (1, 0), "RIGHT")]))
        meta = P(
            f"Área: {clearance.area.name if clearance.area else '-'} · Línea: {clearance.production_line.name if clearance.production_line else '-'} · "
            f"Fecha: {_datetime(clearance.cleared_at)}<br/>"
            f"Producto anterior: {clearance.previous_product or '-'} (Lote {clearance.previous_batch_code or '-'}) · "
            f"Realizado por: {_employee_name(clearance.performed_by)} · Verificado por: {_employee_name(clearance.verified_by)}",
            S_TD_MUTED,
        )
        rows = []
        for criterion in clearance.criteria.all():
            obs = f"Obs: {criterion.observation}" if criterion.observation else ""
            rows.append([P(criterion.get_criterion_display(), S_TD), Pstatus(criterion.get_result_display()), P(obs, S_TD_MUTED)])
        table = data_table(["Criterio", "Resultado", "Observación"], rows, [CONTENT_W * 0.44, CONTENT_W * 0.16, CONTENT_W * 0.40])
        story.append(KeepTogether([header, Spacer(1, 3), meta, Spacer(1, 5), table, Spacer(1, 10)]))
    return story


def render_full_batch_dossier_pdf(batch, *, include_attachments=True, include_photos=True, include_not_applicable=False):
    """Genera un único PDF con el expediente completo del lote en las 16
    secciones acordadas con producción (ver comentario arriba), en el mismo
    orden y con el mismo nivel de detalle que los formatos físicos PRD-FR-*."""
    buffer = io.BytesIO()
    order = batch.production_order
    story = []
    story.extend(_cover_page(batch))

    # 1. Información general de la orden
    story.extend(_numbered_section(1, "Información general de la orden"))
    story.append(field_grid([
        ("PRODUCTO", order.output_item.name if order.output_item_id else "-"),
        ("PRESENTACIÓN / CANTIDAD PLANIFICADA", str(order.planned_quantity)),
        ("LOTE", order.batch_code or "-"),
        ("ORDEN DE PRODUCCIÓN", order.number),
        ("FÓRMULA", order.formula.name if order.formula_id else "-"),
        ("RESPONSABLE DE PRODUCCIÓN", _employee_name(batch.production_manager)),
        ("RESPONSABLE DE CALIDAD", _employee_name(batch.quality_manager)),
        ("ÁREA", batch.area.name if batch.area else "-"),
        ("LÍNEA", batch.production_line.name if batch.production_line else "-"),
        ("FECHA PROGRAMADA", _date(batch.scheduled_at)),
        ("FECHA REAL DE INICIO", _datetime(batch.actual_start_at)),
        ("FECHA REAL DE TERMINACIÓN", _datetime(batch.actual_end_at)),
        ("ESTADO DEL LOTE", batch.get_status_display()),
    ], col_count=2))
    story.extend(observations_block(batch.notes))
    story.append(PageBreak())

    # 2. Verificación documental
    story.extend(_numbered_section(2, "Verificación documental"))
    story.append(_identity_row(batch))
    story.append(Spacer(1, 10))
    items = list(batch.document_checklist.all().order_by("document_code"))
    if not include_not_applicable:
        items = [item for item in items if item.applies]
    total = len(items)
    approved = sum(1 for item in items if item.status == item.Status.APPROVED)
    percentage = round((approved / total) * 100) if total else 0
    story.append(field_grid([("TOTAL DOCUMENTOS", str(total)), ("COMPLETADOS", str(approved)), ("% EXPEDIENTE", f"{percentage}%")], col_count=3))
    story.append(Spacer(1, 10))
    rows = [[item.name, item.get_result_display(), Pstatus(item.get_status_display()), _employee_name(item.verifier)] for item in items]
    story.append(data_table(["Documento", "Resultado", "Estado", "Verificado por"], rows,
                             [CONTENT_W * 0.42, CONTENT_W * 0.16, CONTENT_W * 0.20, CONTENT_W * 0.22]))
    story.append(PageBreak())

    # 3. Formato de control de producción
    production_control = getattr(batch, "production_control", None)
    if production_control is not None:
        story.extend(_numbered_section(3, "Formato de control de producción"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        story.append(field_grid([
            ("TAMAÑO DE LOTE", str(production_control.lot_size or "-")),
            ("UNIDAD", production_control.unit.abbreviation if production_control.unit_id else "-"),
        ]))
        story.append(Spacer(1, 8))
        story.append(section_title("Solicitud y conciliación de materiales de acondicionamiento"))
        story.append(Spacer(1, 4))
        headers = ["Material", "Solicit.", "Entreg.", "Devuelto", "Adicional", "Buenas", "Malas proc.", "Malas fáb.", "Dif."]
        ws = [0.24, 0.09, 0.09, 0.10, 0.10, 0.10, 0.10, 0.10, 0.08]
        widths = [CONTENT_W * w for w in ws]
        rows = []
        for material in production_control.materials.all():
            diff = material.reconciliation_difference
            diff_style = _style("diff", size=7.6, color=(WARNING if diff != 0 else INK))
            rows.append([
                material.item.name, str(material.requested_quantity), str(material.delivered_quantity),
                str(material.returned_quantity), str(material.additional_quantity), str(material.good_units),
                str(material.process_rejects), str(material.factory_rejects), Paragraph(str(diff), diff_style),
            ])
        story.append(data_table(headers, rows, widths, align={i: "RIGHT" for i in range(1, 9)}))
        story.append(generic_signatures_block(production_control))
        story.append(PageBreak())

    # 4. Identificación de línea
    line_identification = getattr(batch, "line_identification", None)
    if line_identification is not None:
        story.extend(_numbered_section(4, "Identificación de línea"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        story.append(field_grid([
            ("ÁREA", line_identification.area.name if line_identification.area else "-"),
            ("LÍNEA", line_identification.production_line.name if line_identification.production_line else "-"),
            ("COLOCADA", _datetime(line_identification.placed_at)),
            ("COLOCADA POR", _employee_name(line_identification.placed_by)),
            ("RETIRADA", _datetime(line_identification.removed_at)),
            ("RETIRADA POR", _employee_name(line_identification.removed_by)),
        ]))
        story.append(generic_signatures_block(line_identification))
        story.append(PageBreak())

    # 5. Verificación de limpieza — acondicionamiento y llenado
    story.extend(_cleaning_records_section(
        5, "Verificación de limpieza y buen estado de equipos — Acondicionamiento y llenado", batch,
        (LineClearance.Phase.FILLING, LineClearance.Phase.PACKAGING),
    ))
    story.append(PageBreak())

    # 6. Despeje de línea — Dispensación
    story.extend(_line_clearances_section(
        6, "Despeje de línea de áreas y equipos — Dispensación", batch, (LineClearance.Phase.DISPENSING,),
    ))
    story.append(PageBreak())

    # 7. Certificado de análisis (calidad)
    certificate = getattr(batch, "analysis_certificate", None)
    microbiology = getattr(batch, "microbiology_analysis", None)
    if certificate is not None or microbiology is not None:
        story.extend(_numbered_section(7, "Certificado de análisis (Calidad)"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        if certificate is not None:
            story.append(field_grid([
                ("FECHA DE FABRICACIÓN", _date(certificate.manufactured_at)),
                ("FECHA DE MUESTREO", _date(certificate.sampled_at)),
                ("FECHA DE ANÁLISIS", _date(certificate.analyzed_at)),
                ("CONCEPTO", certificate.get_concept_display()),
                ("ANALIZADO POR", _employee_name(certificate.analyzed_by)),
                ("VERIFICADO POR", _employee_name(certificate.verified_by)),
            ]))
            story.append(Spacer(1, 8))
            story.append(section_title("Ensayos fisicoquímicos"))
            story.append(Spacer(1, 4))
            rows = []
            for test in certificate.tests.all():
                complies_label = "Cumple" if test.complies else "No cumple" if test.complies is False else "-"
                rows.append([test.name, test.specification, test.bulk_result or "-", test.finished_product_result or "-", Pstatus(complies_label)])
            story.append(data_table(["Ensayo", "Especificación", "Result. granel", "Result. terminado", "Cumple"], rows,
                                     [CONTENT_W * 0.24, CONTENT_W * 0.30, CONTENT_W * 0.18, CONTENT_W * 0.18, CONTENT_W * 0.10]))
            story.append(generic_signatures_block(certificate))
            story.append(Spacer(1, 10))
        if microbiology is not None:
            story.append(section_title("Análisis microbiológico"))
            story.append(Spacer(1, 4))
            story.append(field_grid([
                ("CÓDIGO DE MUESTRA", microbiology.sample_code or "-"),
                ("TIPO DE MUESTRA", microbiology.sample_type or "-"),
                ("FECHA DE TOMA", _date(microbiology.taken_at)),
                ("TOMADA POR", _employee_name(microbiology.taken_by)),
                ("LABORATORIO", microbiology.laboratory or "-"),
                ("N.º DE INFORME", microbiology.report_number or "-"),
                ("RESULTADO GENERAL", microbiology.get_overall_result_display()),
                ("APROBADO POR", _employee_name(microbiology.approved_by)),
            ], col_count=2))
            if microbiology.results:
                story.append(Spacer(1, 6))
                rows = []
                for result in microbiology.results:
                    name = result.get("name", "-") if isinstance(result, dict) else str(result)
                    value = result.get("value", "-") if isinstance(result, dict) else "-"
                    rows.append([name, str(value)])
                story.append(data_table(["Ensayo", "Resultado"], rows, [CONTENT_W * 0.6, CONTENT_W * 0.4]))
        story.append(PageBreak())

    # 8. Control de acondicionamiento
    packaging_control = getattr(batch, "packaging_control", None)
    if packaging_control is not None:
        story.extend(_numbered_section(8, "Control de acondicionamiento"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        story.append(section_title("Etiqueta testigo"))
        story.append(Spacer(1, 4))
        label_fields = [
            ("CÓDIGO DE ETIQUETA", packaging_control.label_code or "-"),
            ("VERSIÓN DEL ARTE", packaging_control.artwork_version or "-"),
            ("LOTE DEL MATERIAL", packaging_control.label_material_batch or "-"),
            ("RESULTADO", packaging_control.get_label_result_display() if packaging_control.label_result else "-"),
            ("REALIZADO POR", _employee_name(packaging_control.label_performed_by)),
            ("VERIFICADO POR", _employee_name(packaging_control.label_verified_by)),
        ]
        img = _load_image_flowable(packaging_control.label_sample_file, 50 * mm, 30 * mm) if include_photos and packaging_control.label_sample_file else None
        left = field_grid(label_fields, col_count=2, col_widths=[CONTENT_W * 0.34] * 2)
        right = [img] if img else [P("Sin foto.", _style("no_photo4", size=8.2, color=MUTED, italic=True, align=TA_CENTER))]
        story.append(Table([[left, right]], colWidths=[CONTENT_W * 0.68, CONTENT_W * 0.32],
                            style=TableStyle([("VALIGN", (0, 0), (0, 0), "TOP"), ("VALIGN", (1, 0), (1, 0), "MIDDLE"),
                                               ("LEFTPADDING", (0, 0), (-1, -1), 0)])))
        story.append(Spacer(1, 10))

        story.append(section_title("Loteado inicial y final"))
        story.append(Spacer(1, 4))
        markings = list(packaging_control.lot_markings.all().order_by("created_at"))
        for marking in markings:
            stage_label = "Loteado inicial" if marking.stage == "INITIAL" else "Loteado final"
            meta = field_grid([
                ("LOTE IMPRESO", marking.printed_batch_code or "-"),
                ("FABRICACIÓN", _date(marking.manufacture_date)),
                ("VENCE", _date(marking.expiry_date)),
                ("LEGIBLE", "Sí" if marking.is_legible else "No" if marking.is_legible is False else "-"),
                ("UBICACIÓN CORRECTA", "Sí" if marking.is_correctly_placed else "No" if marking.is_correctly_placed is False else "-"),
                ("REALIZADO / VERIFICADO", f"{_employee_name(marking.performed_by)} / {_employee_name(marking.verified_by)}"),
            ], col_count=3, col_widths=[CONTENT_W * 0.68 / 3] * 3)
            header = Table([[P(stage_label, S_BODY_BOLD), Pstatus(marking.get_result_display() if marking.result else "-")]],
                            colWidths=[CONTENT_W * 0.68 * 0.7, CONTENT_W * 0.68 * 0.3],
                            style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("ALIGN", (1, 0), (1, 0), "RIGHT")]))
            left_block = [header, Spacer(1, 3), meta]
            img = _load_image_flowable(marking.photo, CONTENT_W * 0.28, 26 * mm) if include_photos and marking.photo else None
            right_block = [img] if img else [P("Sin foto.", _style("no_photo", size=8.2, color=MUTED, italic=True, align=TA_CENTER))]
            row = Table([[left_block, right_block]], colWidths=[CONTENT_W * 0.68, CONTENT_W * 0.32],
                        style=TableStyle([("VALIGN", (0, 0), (0, 0), "TOP"), ("VALIGN", (1, 0), (1, 0), "MIDDLE"),
                                           ("LEFTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
            story.append(KeepTogether([row, Spacer(1, 4)]))
        if not markings:
            story.append(empty_note("Sin registros de loteado."))
        story.append(Spacer(1, 8))

        story.append(section_title("Conciliación de empaque"))
        story.append(Spacer(1, 4))
        story.append(field_grid([
            ("UNIDADES POR DISPLAY", str(packaging_control.units_per_display or "-")),
            ("DISPLAYS POR CAJA", str(packaging_control.displays_per_box or "-")),
            ("UNIDADES POR CAJA", str(packaging_control.units_per_box or "-")),
            ("CAJAS COMPLETAS", str(packaging_control.complete_boxes)),
            ("DISPLAYS INCOMPLETOS", str(packaging_control.incomplete_displays)),
            ("UNIDADES SUELTAS", str(packaging_control.loose_units)),
            ("TOTAL CONCILIADO", str(packaging_control.total_reconciled)),
            ("SALDOS", str(packaging_control.balances)),
            ("RECHAZOS", str(packaging_control.rejections)),
        ], col_count=3))
        story.extend(observations_block(packaging_control.rejection_reasons, title="Motivos de rechazo"))
        story.append(generic_signatures_block(packaging_control))
        story.append(PageBreak())

    # 9. Verificación de limpieza — dispensación y fabricación
    story.extend(_cleaning_records_section(
        9, "Verificación de limpieza y buen estado de equipos — Dispensación y fabricación", batch,
        (LineClearance.Phase.DISPENSING, LineClearance.Phase.MANUFACTURING),
    ))
    story.append(PageBreak())

    # 10. Orden de dispensación
    dispensing_order = getattr(batch, "dispensing_order", None)
    if dispensing_order is not None:
        story.extend(_numbered_section(10, "Orden de dispensación"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        story.append(field_grid([
            ("ESTADO", dispensing_order.get_status_display()),
            ("FECHA DE EMISIÓN", _date(dispensing_order.issued_at)),
            ("RESPONSABLE", _employee_name(dispensing_order.responsible)),
            ("VERIFICADOR", _employee_name(dispensing_order.verifier)),
        ]))
        story.append(Spacer(1, 8))
        story.append(section_title("Detalle por materia prima"))
        story.append(Spacer(1, 4))
        headers = ["#", "Materia prima", "Lote MP", "Teórica", "Pesada", "Adición", "Devuelto", "Desv.%", "Estado"]
        ws = [0.04, 0.24, 0.12, 0.11, 0.11, 0.10, 0.10, 0.09, 0.09]
        widths = [CONTENT_W * w for w in ws]
        rows = []
        for line in dispensing_order.lines.all().order_by("sequence"):
            deviation = line.deviation_percentage
            rows.append([
                str(line.sequence), line.item.name,
                line.raw_material_batch.supplier_batch_code if line.raw_material_batch_id else "-",
                f"{line.theoretical_quantity:.3f}", f"{line.net_weight:.3f}" if line.net_weight is not None else "-",
                f"{line.additional_quantity:.3f}" if line.additional_quantity else "-",
                f"{line.returned_quantity:.3f}" if line.returned_quantity else "-",
                f"{deviation:.2f}" if deviation is not None else "-", Pstatus(line.get_status_display()),
            ])
        story.append(data_table(headers, rows, widths, align={0: "CENTER", 3: "RIGHT", 4: "RIGHT", 5: "RIGHT", 6: "RIGHT", 7: "RIGHT"}))
        story.append(signature_block_row([
            ("Responsable de dispensación", _employee_name(dispensing_order.responsible), None, dispensing_order.responsible_signature),
            ("Verificador de dispensación", _employee_name(dispensing_order.verifier), None, dispensing_order.verifier_signature),
        ]))
        story.append(PageBreak())

    # 11. Instrucciones de fabricación
    step_executions = list(batch.step_executions.select_related("step").order_by("step__sequence"))
    if step_executions:
        story.extend(_numbered_section(11, "Instrucciones de fabricación"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        for execution in step_executions:
            step = execution.step
            block = [
                Table([[P(f"Paso {step.sequence}. {step.phase or '-'}", S_BODY_BOLD), Pstatus(execution.get_status_display())]],
                      colWidths=[CONTENT_W * 0.75, CONTENT_W * 0.25],
                      style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("ALIGN", (1, 0), (1, 0), "RIGHT")])),
                Spacer(1, 2),
                P(step.instruction, S_BODY_MUTED),
                Spacer(1, 4),
                field_grid([
                    ("EQUIPO", step.required_equipment or "-"),
                    ("TEMP. OBJETIVO/REAL", f"{step.target_temperature or '-'} / {execution.actual_temperature or '-'}"),
                    ("TIEMPO OBJETIVO/REAL (MIN)", f"{step.target_time_minutes or '-'} / {execution.actual_time_minutes or '-'}"),
                    ("PH OBJETIVO/REAL", f"{step.target_ph or '-'} / {execution.actual_ph or '-'}"),
                    ("VELOCIDAD AGITACIÓN", execution.actual_agitation_speed or step.target_agitation_speed or "-"),
                    ("PRESIÓN", execution.actual_pressure or step.target_pressure or "-"),
                    ("REALIZADO POR", _employee_name(execution.performed_by)),
                    ("VERIFICADO POR", _employee_name(execution.verified_by)),
                    ("INICIO", _datetime(execution.started_at)),
                    ("FIN", _datetime(execution.finished_at)),
                ], col_count=2),
            ]
            if execution.deviation:
                block.append(P(f"Desviación: {execution.deviation}", _style("dev2", size=7.6, color=DANGER)))
            block.append(generic_signatures_block(execution))
            block.append(Spacer(1, 8))
            block.append(Table([[""]], colWidths=[CONTENT_W], style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, GRID)])))
            block.append(Spacer(1, 10))
            story.append(KeepTogether(block))
        story.append(PageBreak())

    # 12. Control de llenado
    filling_control = getattr(batch, "filling_control", None)
    if filling_control is not None:
        story.extend(_numbered_section(12, "Control de llenado"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        story.append(field_grid([
            ("LÍNEA", filling_control.production_line.name if filling_control.production_line else "-"),
            ("EQUIPO", filling_control.equipment or "-"),
            ("TANQUE DE ORIGEN", filling_control.source_tank or "-"),
            ("INICIO DE LLENADO", _datetime(filling_control.started_at)),
            ("FIN DE LLENADO", _datetime(filling_control.finished_at)),
            ("RESPONSABLE", _employee_name(filling_control.responsible)),
            ("VERIFICADOR", _employee_name(filling_control.verifier)),
            ("CANTIDAD PROGRAMADA", str(filling_control.planned_quantity or "-")),
            ("CANTIDAD PRODUCIDA", str(filling_control.produced_quantity)),
            ("CANTIDAD RECHAZADA", str(filling_control.rejected_quantity)),
            ("CANTIDAD RECUPERADA", str(filling_control.recovered_quantity)),
            ("RENDIMIENTO", f"{filling_control.yield_percentage:.1f}%" if filling_control.yield_percentage is not None else "-"),
        ], col_count=3))
        story.append(Spacer(1, 8))
        participants = list(filling_control.participants.all())
        if participants:
            story.append(section_title("Personal que interviene en el proceso"))
            story.append(Spacer(1, 4))
            rows = [[p.activity or p.role, _employee_name(p.employee), _datetime(p.check_in), _datetime(p.check_out)] for p in participants]
            story.append(data_table(["Actividad", "Empleado", "Ingreso", "Salida"], rows,
                                     [CONTENT_W * 0.28, CONTENT_W * 0.30, CONTENT_W * 0.21, CONTENT_W * 0.21]))
            story.append(Spacer(1, 8))
        log_entries = list(filling_control.log_entries.all())
        if log_entries:
            story.append(section_title("Control de empaque (registro periódico)"))
            story.append(Spacer(1, 4))
            rows = []
            for entry in log_entries:
                rows.append([_datetime(entry.recorded_at), str(entry.units_produced), str(entry.displays), str(entry.boxes),
                             str(entry.units_rejected), entry.rejection_reason or "-"])
            story.append(data_table(["Fecha", "Producidas", "Displays", "Cajas", "Rechazadas", "Motivo"], rows,
                                     [CONTENT_W * 0.22, CONTENT_W * 0.14, CONTENT_W * 0.13, CONTENT_W * 0.11, CONTENT_W * 0.14, CONTENT_W * 0.26],
                                     align={1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"}))
            story.append(Spacer(1, 8))
        story.append(generic_signatures_block(filling_control))
        story.append(PageBreak())

    # 13. Control de peso y/o volumen
    weight_control = getattr(batch, "weight_volume_control", None)
    if weight_control is not None:
        story.extend(_numbered_section(13, "Control de peso y/o volumen"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        story.append(field_grid([
            ("TARA", str(weight_control.tare or "-")),
            ("LÍMITE INFERIOR", str(weight_control.lower_limit or "-")),
            ("LÍMITE SUPERIOR", str(weight_control.upper_limit or "-")),
            ("UNIDAD", weight_control.unit.abbreviation if weight_control.unit_id else "-"),
            ("RESULTADO GENERAL", weight_control.get_overall_result_display()),
            ("AUTORIZÓ REANUDACIÓN", _employee_name(weight_control.resumed_authorized_by) if weight_control.resumed_authorized_by_id else "-"),
        ]))
        story.append(Spacer(1, 8))
        samples = list(weight_control.samples.all())
        net_values = [float(s.net_weight) for s in samples if s.net_weight is not None]
        if net_values:
            average = sum(net_values) / len(net_values)
            minimum, maximum = min(net_values), max(net_values)
            out_of_spec = sum(1 for s in samples if s.result == "NO")
            pct = round((out_of_spec / len(samples)) * 100) if samples else 0
            story.append(field_grid([
                ("PROMEDIO", f"{average:.3f}"), ("MÍNIMO", f"{minimum:.3f}"), ("MÁXIMO", f"{maximum:.3f}"),
                ("% FUERA DE ESPECIFICACIÓN", f"{pct}%"),
            ], col_count=4))
            story.append(Spacer(1, 8))
        story.append(section_title("Muestras"))
        story.append(Spacer(1, 4))
        rows = []
        for sample in samples:
            obs = f"Ajuste: {sample.adjustment_made}" if sample.adjustment_made else ""
            rows.append([
                str(sample.sample_number), str(sample.gross_weight or "-"), str(sample.tare or "-"),
                str(sample.net_weight if sample.net_weight is not None else "-"), str(sample.volume or "-"),
                Pstatus(sample.get_result_display()), P(obs, S_TD_MUTED),
            ])
        story.append(data_table(["Muestra", "Bruto", "Tara", "Neto", "Vol.", "Resultado", "Observación"], rows,
                                 [CONTENT_W * 0.08, CONTENT_W * 0.12, CONTENT_W * 0.12, CONTENT_W * 0.12, CONTENT_W * 0.10, CONTENT_W * 0.16, CONTENT_W * 0.30],
                                 align={0: "CENTER", 1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"}))
        story.append(generic_signatures_block(weight_control))
        story.append(PageBreak())

    # 14. Despeje de línea — Fabricación / Llenado / Acondicionamiento
    story.extend(_line_clearances_section(
        14, "Despeje de línea de áreas y equipos — Fabricación, llenado y acondicionamiento", batch,
        (LineClearance.Phase.MANUFACTURING, LineClearance.Phase.FILLING, LineClearance.Phase.PACKAGING),
    ))
    story.append(PageBreak())

    # 15. Control de hermeticidad
    seal_control = getattr(batch, "seal_integrity_control", None)
    if seal_control is not None:
        story.extend(_numbered_section(15, "Control de hermeticidad"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        story.append(field_grid([
            ("EQUIPO", seal_control.equipment or "-"),
            ("CÓDIGO DEL EQUIPO", seal_control.equipment_code or "-"),
            ("FECHA Y HORA", _datetime(seal_control.tested_at)),
            ("PRESIÓN (BAR)", str(seal_control.pressure_bar or "-")),
            ("TIEMPO (S)", str(seal_control.time_seconds or "-")),
            ("RESULTADO GENERAL", seal_control.get_overall_result_display()),
        ]))
        story.append(Spacer(1, 8))
        story.append(section_title("Muestras"))
        story.append(Spacer(1, 4))
        rows = [[str(s.sample_number), Pstatus(s.get_result_display()), P(s.observation or "", S_TD_MUTED)] for s in seal_control.samples.all()]
        story.append(data_table(["Muestra", "Resultado", "Observación"], rows,
                                 [CONTENT_W * 0.14, CONTENT_W * 0.20, CONTENT_W * 0.66], align={0: "CENTER"}))
        story.extend(observations_block(seal_control.observations))
        story.append(generic_signatures_block(seal_control))
        story.append(PageBreak())

    # 16. Identificación de materia prima dispensada
    if dispensing_order is not None:
        dispensing_lines = list(dispensing_order.lines.all().order_by("sequence"))
        if dispensing_lines:
            story.extend(_numbered_section(16, "Identificación de materia prima dispensada"))
            story.append(_identity_row(batch))
            story.append(Spacer(1, 10))
            for line in dispensing_lines:
                raw_batch = line.raw_material_batch
                header = P(f"{line.sequence}. {line.item.name} ({line.item.code})", S_BODY_BOLD)
                meta = field_grid([
                    ("LOTE DE MATERIA PRIMA", raw_batch.supplier_batch_code if raw_batch else "-"),
                    ("N.º DE ANÁLISIS", raw_batch.analysis_number if raw_batch else "-"),
                    ("FECHA DE VENCIMIENTO", _date(raw_batch.expires_at) if raw_batch else "-"),
                    ("ESTADO DE CALIDAD", raw_batch.get_quality_status_display() if raw_batch else "-"),
                    ("TARA", str(line.tare) if line.tare is not None else "-"),
                    ("PESO NETO", str(line.net_weight) if line.net_weight is not None else "-"),
                    ("RECIPIENTE", line.container or "-"),
                    ("PESADO POR", _employee_name(line.weighed_by)),
                    ("VERIFICADO POR", _employee_name(line.verified_by)),
                ], col_count=3)
                block = [header, Spacer(1, 3), meta]
                prints = list(line.identification_prints.order_by("-printed_at"))
                if prints:
                    latest = prints[0]
                    label = "Reimpresión" if latest.is_reprint else "Impresión original"
                    extra = f" · Motivo: {latest.reprint_reason}" if latest.is_reprint and latest.reprint_reason else ""
                    block.append(P(f"{label} · {_datetime(latest.printed_at)}{extra}", S_TD_MUTED))
                block.append(Spacer(1, 8))
                block.append(Table([[""]], colWidths=[CONTENT_W], style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, GRID)])))
                block.append(Spacer(1, 8))
                story.append(KeepTogether(block))
            story.append(PageBreak())

    # Liberación final
    release = getattr(batch, "release", None)
    if release is not None:
        story.extend(_numbered_section("", "Liberación de producto terminado"))
        story.append(_identity_row(batch))
        story.append(Spacer(1, 10))
        story.append(field_grid([
            ("CANTIDAD LIBERADA", str(release.released_quantity)),
            ("CANTIDAD RETENIDA", str(release.retained_quantity)),
            ("CANTIDAD RECHAZADA", str(release.rejected_quantity)),
            ("CONDICIÓN", release.get_condition_display()),
            ("FECHA DE LIBERACIÓN", _datetime(release.released_at)),
            ("BODEGA DESTINO", release.warehouse_location.name if release.warehouse_location_id else "-"),
        ]))
        story.extend(observations_block(release.observations))
        story.append(signature_block_row([
            ("Liberado por Calidad", _employee_name(release.released_by_quality), None, release.quality_signature),
            ("Aprobado por Director Técnico", _employee_name(release.approved_by_technical_director), None, release.technical_director_signature),
        ]))
        story.append(PageBreak())

    # Anexos
    if include_attachments:
        attachments = list(batch.attachments.all())
        if attachments:
            story.extend(_numbered_section("", "Anexos"))
            story.append(_identity_row(batch))
            story.append(Spacer(1, 10))
            rows = [[a.original_name or a.file.name, a.description or "-"] for a in attachments]
            story.append(data_table(["Archivo", "Descripción"], rows, [CONTENT_W * 0.5, CONTENT_W * 0.5]))

    # Elimina el PageBreak final sobrante si el último bloque ya cerró página
    while story and isinstance(story[-1], PageBreak):
        story.pop()

    _build(
        buffer, story, doc_code="PRD-EXP-000",
        footer_status=batch.get_status_display(),
    )
    buffer.seek(0)
    return buffer
