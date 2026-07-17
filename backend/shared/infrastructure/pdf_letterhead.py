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

# Aire entre la franja del membrete y el contenido del encabezado (nombre de área,
# número de documento, etc.). Se mantiene igual en los tres documentos para dar
# una jerarquía visual consistente: franja pegada arriba -> respiro -> contenido.
HEADER_CONTENT_GAP = 34

_image_cache: dict[str, ImageReader] = {}


def _cached_image(path):
    if path not in _image_cache:
        if not os.path.exists(path):
            _image_cache[path] = None
        else:
            _image_cache[path] = ImageReader(path)
    return _image_cache[path]


def draw_letterhead_header(c, page_w, page_h, x0, x1):
    """Dibuja la franja decorativa oficial completamente pegada al borde superior de
    la hoja (sin ningún espacio en blanco por encima), a todo el ancho de la página
    (fuera de los márgenes de contenido, igual que en el membrete original). Devuelve
    la coordenada y donde debe comenzar el resto del encabezado, ya con el respiro
    (HEADER_CONTENT_GAP) aplicado para que el contenido no quede pegado a la franja."""
    image = _cached_image(HEADER_IMAGE_PATH)
    if image is None:
        return page_h - HEADER_CONTENT_GAP
    iw, ih = image.getSize()
    h = page_w * (ih / iw) if iw else 0
    y = page_h - h
    try:
        c.drawImage(image, 0, y, width=page_w, height=h, preserveAspectRatio=False, mask="auto")
    except Exception:
        return page_h - HEADER_CONTENT_GAP
    return y - HEADER_CONTENT_GAP


def draw_letterhead_footer(c, page_w, x0, x1):
    """Dibuja la franja de pie de página oficial (contacto), completamente pegada al
    borde inferior y a todo el ancho de la página, con los íconos y datos de contacto
    centrados/distribuidos tal como en el diseño original (no se recorta ni se
    reubica ningún elemento). Devuelve la altura ocupada, para que el contenido
    reserve el margen inferior correspondiente y nunca invada la franja."""
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
    """Devuelve un ImageReader a partir de una firma, o None si no hay/está corrupta.

    Acepta dos tipos de entrada, ya que ambos se usan indistintamente según el flujo:
    - Un ``FieldFile`` ya guardado en storage (ej. ``employee.signature``).
    - Un archivo recién subido en el request (``request.FILES.get("signature")``,
      ``InMemoryUploadedFile``/``TemporaryUploadedFile``), que no tiene ``.storage``
      y debe leerse directamente con ``.read()``.
    """
    if not signature_file:
        return None
    try:
        storage = getattr(signature_file, "storage", None)
        if storage is not None:
            if not storage.exists(signature_file.name):
                return None
            with signature_file.open("rb") as fobj:
                return ImageReader(io.BytesIO(fobj.read()))
        signature_file.seek(0)
        return ImageReader(io.BytesIO(signature_file.read()))
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
