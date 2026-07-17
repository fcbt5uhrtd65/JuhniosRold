"""Membrete oficial (2 franjas: encabezado + pie) y bloque de firma reutilizables
en todos los documentos PDF (solicitudes de RRHH, certificado laboral, perfil de empleado).
"""
import io
import os

from reportlab.lib.utils import ImageReader

_ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "assets"))
HEADER_IMAGE_PATH = os.path.join(_ASSETS_DIR, "letterhead_header.png")
FOOTER_IMAGE_PATH = os.path.join(_ASSETS_DIR, "letterhead_footer.png")

# Tamaño fijo y moderado de firma para todos los documentos: ni muy grande ni muy pequeña.
SIGNATURE_WIDTH = 120
SIGNATURE_HEIGHT = 40

_image_cache: dict[str, ImageReader] = {}


def _cached_image(path):
    if path not in _image_cache:
        if not os.path.exists(path):
            _image_cache[path] = None
        else:
            _image_cache[path] = ImageReader(path)
    return _image_cache[path]


def draw_letterhead_header(c, page_w, page_h, x0, x1):
    """Dibuja la franja decorativa oficial pegada al borde superior e izquierdo/derecho
    de la hoja (a todo el ancho de la página, sin respetar los márgenes de contenido —
    igual que en el membrete original de Word). Devuelve la coordenada y donde puede
    comenzar el resto del encabezado."""
    image = _cached_image(HEADER_IMAGE_PATH)
    top_y = page_h - 34
    if image is None:
        return top_y
    iw, ih = image.getSize()
    h = page_w * (ih / iw) if iw else 0
    y = page_h - h
    try:
        c.drawImage(image, 0, y, width=page_w, height=h, preserveAspectRatio=False, mask="auto")
    except Exception:
        return top_y
    return y - 18


def draw_letterhead_footer(c, page_w, x0, x1):
    """Dibuja la franja de pie de página oficial (contacto) pegada al borde inferior e
    izquierdo/derecho de la hoja (a todo el ancho de la página). Devuelve la altura
    ocupada (para reservar margen inferior en el contenido)."""
    image = _cached_image(FOOTER_IMAGE_PATH)
    if image is None:
        return 0
    iw, ih = image.getSize()
    h = page_w * (ih / iw) if iw else 0
    try:
        c.drawImage(image, 0, 0, width=page_w, height=h, preserveAspectRatio=False, mask="auto")
    except Exception:
        return 0
    return h


def resolve_signature_image(signature_file):
    """Devuelve un ImageReader a partir de un FileField de firma, o None si no hay/está corrupto."""
    if not signature_file:
        return None
    try:
        if not signature_file.storage.exists(signature_file.name):
            return None
        with signature_file.open("rb") as fobj:
            return ImageReader(io.BytesIO(fobj.read()))
    except Exception:
        return None


def draw_signature_line_block(c, x0, line_y, w, signer_name, role_label, signature_file, font=("Helvetica", "Helvetica-Bold"), navy=None, muted=None):
    """Bloque de firma estándar para todos los documentos:

    imagen de firma (tamaño fijo, apoyada directamente sobre la línea) → línea sólida →
    nombre en negrita → cargo/rol debajo.

    ``line_y`` es la coordenada exacta donde se dibuja la línea de firma; la imagen se
    dibuja inmediatamente encima, pegada a la línea (sin espacio en blanco entre ambas).
    """
    font_regular, font_bold = font

    image = resolve_signature_image(signature_file)
    if image is not None:
        try:
            iw, ih = image.getSize()
            draw_w = SIGNATURE_WIDTH
            draw_h = draw_w * (ih / iw) if iw else SIGNATURE_HEIGHT
            if draw_h > SIGNATURE_HEIGHT:
                draw_h = SIGNATURE_HEIGHT
                draw_w = draw_h * (iw / ih) if ih else SIGNATURE_WIDTH
            image_x = x0 + (w - draw_w) / 2
            c.drawImage(image, image_x, line_y, width=draw_w, height=draw_h, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    if navy is None:
        from reportlab.lib.colors import HexColor
        navy = HexColor("#1B3A6B")
    if muted is None:
        from reportlab.lib.colors import HexColor
        muted = HexColor("#5D6D7E")

    c.setStrokeColor(muted)
    c.setLineWidth(0.8)
    c.line(x0, line_y, x0 + w, line_y)

    c.setFont(font_bold, 10)
    c.setFillColor(navy)
    c.drawCentredString(x0 + w / 2, line_y - 13, signer_name.upper())

    c.setFont(font_regular, 8.3)
    c.setFillColor(muted)
    c.drawCentredString(x0 + w / 2, line_y - 25, role_label)

    return line_y - 25
