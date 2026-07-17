import io

from django.utils import timezone
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

BRAND_COLOR = HexColor("#2a4038")
TEXT_COLOR = HexColor("#111827")
MUTED_COLOR = HexColor("#6b7280")
LINE_COLOR = HexColor("#e5e7eb")


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def resolve_signature_file(step=None, employee=None):
    """Devuelve el FieldFile de firma a usar: el override puntual del paso de
    aprobacion si existe, o si no la firma guardada por defecto del empleado."""
    override = getattr(step, "signature", None) if step is not None else None
    if override:
        return override
    if employee is not None:
        signature = getattr(employee, "signature", None)
        if signature:
            return signature
    return None


def resolve_signature_image(signature_file):
    """Convierte un FieldFile de firma en un ImageReader listo para dibujar, o
    None si el archivo no existe o no se puede leer (nunca lanza)."""
    if not signature_file:
        return None
    try:
        if not signature_file.storage.exists(signature_file.name):
            return None
        with signature_file.open("rb") as file_obj:
            return ImageReader(io.BytesIO(file_obj.read()))
    except Exception:
        return None


def draw_signature_block(c, x, y, w, *, signature_file, signer_name, role_label, decided_at=None, height=70):
    """Dibuja un bloque de firma: imagen (si hay), linea, nombre, rol y fecha.

    (x, y) es la esquina superior izquierda del bloque; w es el ancho disponible.
    Devuelve el nuevo y (por debajo del bloque dibujado).
    """
    image = resolve_signature_image(signature_file)
    image_h = 46
    image_y = y - 4

    if image is not None:
        try:
            iw, ih = image.getSize()
            draw_w = min(w * 0.6, image_h * (iw / ih) if ih else w * 0.6)
            draw_x = x + (w - draw_w) / 2
            c.drawImage(image, draw_x, image_y - image_h, width=draw_w, height=image_h, preserveAspectRatio=True, mask="auto")
        except Exception:
            image = None

    line_y = image_y - image_h - 4
    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(0.8)
    c.line(x + w * 0.12, line_y, x + w * 0.88, line_y)

    c.setFillColor(TEXT_COLOR)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x + w / 2, line_y - 13, _safe(signer_name, "Sin firmante"))

    c.setFillColor(BRAND_COLOR)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(x + w / 2, line_y - 24, _safe(role_label, ""))

    c.setFillColor(MUTED_COLOR)
    c.setFont("Helvetica", 6.8)
    timestamp = decided_at or timezone.now()
    label = "Firmado digitalmente" if image is not None else "Firma pendiente"
    c.drawCentredString(x + w / 2, line_y - 35, f"{label} · {timestamp:%d/%m/%Y %H:%M}")

    return line_y - 35
