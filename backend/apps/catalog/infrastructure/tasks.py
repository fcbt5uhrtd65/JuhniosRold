import base64
import binascii
import hashlib
import io
import logging
import re
import socket
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urlparse
from uuid import uuid4

from celery import shared_task
from django.conf import settings
from openpyxl import Workbook
from openpyxl.styles import Font
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image as RLImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .models import Product

logger = logging.getLogger(__name__)

IMAGE_CACHE_DIR = Path(settings.MEDIA_ROOT) / "cache" / "images"

COLUMNS = (
    ("nombre", "Nombre"),
    ("presentacion", "Presentación"),
    ("categoria", "Categoría"),
    ("tipo", "Tipo"),
    ("marca", "Marca"),
    ("sku", "SKU"),
    ("precio", "Precio"),
    ("precio_costo", "Precio costo"),
    ("margen", "Margen %"),
    ("estado", "Estado"),
    ("stock_actual", "Stock actual"),
    ("stock_minimo", "Stock mínimo"),
    ("fecha_creacion", "Fecha creación"),
)

MAX_EXPORT_PRODUCT_IDS = 1000
IMAGE_DOWNLOAD_TIMEOUT = 5
MAX_IMAGE_BYTES = 5 * 1024 * 1024
DATA_URL_RE = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,(?P<data>.+)$")


def _is_safe_public_url(url):
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        for info in socket.getaddrinfo(parsed.hostname, None):
            ip = info[4][0]
            if (
                ip.startswith("127.")
                or ip.startswith("10.")
                or ip.startswith("169.254.")
                or ip == "::1"
                or ip.startswith("192.168.")
                or any(ip.startswith(f"172.{n}.") for n in range(16, 32))
            ):
                return False
        return True
    except (ValueError, socket.gaierror):
        return False


def _download_public_image(url, skip_ssrf_check=False):
    if not skip_ssrf_check and not _is_safe_public_url(url):
        return None
    cache_key = hashlib.sha256(url.encode()).hexdigest()
    IMAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = IMAGE_CACHE_DIR / cache_key
    if cache_path.exists():
        data = cache_path.read_bytes()
        return data if len(data) <= MAX_IMAGE_BYTES else None
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "JuhniosRold-Export/1.0"})
        with urllib.request.urlopen(request, timeout=IMAGE_DOWNLOAD_TIMEOUT) as response:
            data = response.read(MAX_IMAGE_BYTES + 1)
    except Exception:
        return None
    if len(data) <= MAX_IMAGE_BYTES:
        cache_path.write_bytes(data)
        return data
    return None


def _load_image_bytes(image_ref):
    if not image_ref:
        return None

    data_url_match = DATA_URL_RE.match(image_ref)
    if data_url_match:
        try:
            return base64.b64decode(data_url_match.group("data"), validate=True)
        except (binascii.Error, ValueError):
            return None

    media_url = settings.MEDIA_URL
    if image_ref.startswith(media_url):
        relative_path = image_ref[len(media_url):]
        local_path = (Path(settings.MEDIA_ROOT) / relative_path).resolve()
        media_root = Path(settings.MEDIA_ROOT).resolve()
        if media_root not in local_path.parents and local_path != media_root:
            return None
        try:
            data = local_path.read_bytes()
        except OSError:
            return None
        return data if len(data) <= MAX_IMAGE_BYTES else None

    if image_ref.startswith(("http://", "https://")):
        return _download_public_image(image_ref)

    if image_ref.startswith("/"):
        # Rutas como "/images/catalog/foo.png" son estáticos del frontend.
        # Si hay una copia local montada (FRONTEND_PUBLIC_DIR), se lee del
        # filesystem directamente: en desarrollo, "localhost" dentro del
        # contenedor del backend no apunta al dev server de Vite, así que la
        # descarga por HTTP fallaría aunque el archivo exista.
        if settings.FRONTEND_PUBLIC_DIR:
            public_root = Path(settings.FRONTEND_PUBLIC_DIR).resolve()
            local_path = (public_root / image_ref.lstrip("/")).resolve()
            if public_root in local_path.parents or local_path == public_root:
                try:
                    data = local_path.read_bytes()
                    if len(data) <= MAX_IMAGE_BYTES:
                        return data
                except OSError:
                    pass

        # Si no hay copia local (o no se encontró el archivo), se resuelven
        # contra FRONTEND_URL (URL de configuración, no entrada externa, por
        # eso se omite el chequeo SSRF que sí aplica a URLs arbitrarias
        # guardadas en la base de datos). quote() escapa espacios y demás
        # caracteres presentes en los nombres de archivo del catálogo
        # (p.ej. "Aceite Capilar Argan 8ml.png").
        encoded_path = quote(image_ref)
        return _download_public_image(settings.FRONTEND_URL.rstrip("/") + encoded_path, skip_ssrf_check=True)

    return None


def _resolve_image(image_ref):
    data = _load_image_bytes(image_ref)
    if not data:
        return None
    try:
        image = PILImage.open(io.BytesIO(data))
        image.load()
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        return image
    except Exception:
        logger.warning("No se pudo procesar la imagen de producto: %s", image_ref, exc_info=True)
        return None


def _variant_image_url(variant, product):
    """Imagen propia de la variante (galería > image_url legado), con el
    producto como último recurso solo si la variante no tiene ninguna."""
    images = list(variant.images.all())
    primary = next((img for img in images if img.is_primary), images[0] if images else None)
    if primary:
        return primary.image
    if variant.image_url:
        return variant.image_url
    return product.image_url


def _collect_rows(product_ids):
    products = (
        Product.objects.filter(id__in=product_ids)
        .select_related("category")
        .prefetch_related("variants__prices", "variants__stocks", "variants__images")
    )
    rows = []
    for product in products:
        variants = list(product.variants.all())
        if not variants:
            rows.append({
                "image_url": product.image_url,
                "nombre": product.name,
                "presentacion": "",
                "categoria": product.category.name if product.category else "",
                "tipo": "",
                "marca": "",
                "sku": "",
                "precio": "",
                "precio_costo": "",
                "margen": "",
                "estado": "Activo" if product.is_active else "Inactivo",
                "stock_actual": "",
                "stock_minimo": "",
                "fecha_creacion": product.created_at.strftime("%Y-%m-%d") if product.created_at else "",
            })
            continue

        for variant in variants:
            prices = list(variant.prices.all())
            price = next((p for p in prices if p.is_active), prices[0] if prices else None)

            cost = variant.cost
            amount = price.amount if price else None
            margen = None
            if amount and cost and amount > 0:
                margen = round(float((amount - cost) / amount) * 100, 2)

            stocks = list(variant.stocks.all())
            stock_actual = sum(s.quantity for s in stocks) if stocks else None
            stock_minimo = sum(s.minimum_quantity for s in stocks) if stocks else None

            attrs = variant.attributes if isinstance(variant.attributes, dict) else {}
            rows.append({
                "image_url": _variant_image_url(variant, product),
                "nombre": product.name,
                "presentacion": variant.presentation_label,
                "categoria": product.category.name if product.category else "",
                "tipo": attrs.get("type", ""),
                "marca": attrs.get("brand", attrs.get("marca", "")),
                "sku": variant.sku,
                "precio": float(amount) if amount is not None else "",
                "precio_costo": float(cost) if cost is not None else "",
                "margen": margen if margen is not None else "",
                "estado": "Activo" if product.is_active and variant.is_active else "Inactivo",
                "stock_actual": float(stock_actual) if stock_actual is not None else "",
                "stock_minimo": float(stock_minimo) if stock_minimo is not None else "",
                "fecha_creacion": product.created_at.strftime("%Y-%m-%d") if product.created_at else "",
            })
    return rows


@shared_task
def export_products(product_ids, output_format="xlsx", pdf_layout="table"):
    rows = _collect_rows(product_ids[:MAX_EXPORT_PRODUCT_IDS])

    export_dir = Path(settings.MEDIA_ROOT) / "exports" / "products"
    export_dir.mkdir(parents=True, exist_ok=True)
    filename = f"productos-{uuid4().hex}.{output_format}"
    output_path = export_dir / filename

    if output_format == "pdf":
        if pdf_layout == "catalog":
            _write_pdf_catalog(output_path, rows)
        else:
            _write_pdf_table(output_path, rows)
    else:
        _write_xlsx(output_path, rows)

    return {
        "status": "generated",
        "count": len(rows),
        "url": f"{settings.MEDIA_URL}exports/products/{filename}",
    }


def _write_xlsx(path, rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Productos"
    sheet.append([label for _, label in COLUMNS])
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for row in rows:
        sheet.append([row[key] for key, _ in COLUMNS])
    for column_cells in sheet.columns:
        max_length = max((len(str(c.value)) if c.value is not None else 0) for c in column_cells)
        sheet.column_dimensions[column_cells[0].column_letter].width = min(max_length + 2, 40)
    workbook.save(path)


PDF_IMAGE_PX_PER_CM = 118  # ~300 DPI, nítido tanto en pantalla como impreso


def _image_to_jpeg_bytes(image, max_size_cm=1.6):
    max_px = int(max_size_cm * PDF_IMAGE_PX_PER_CM)
    thumb = image.copy()
    thumb.thumbnail((max_px, max_px), PILImage.LANCZOS)
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=90, optimize=True)
    return buf.getvalue(), thumb.size


def _make_rlimage(jpeg_bytes, size, max_size_cm=1.6, **_):
    w, h = size
    max_size = max_size_cm * cm
    scale = min(max_size / w, max_size / h)
    return RLImage(io.BytesIO(jpeg_bytes), width=w * scale, height=h * scale)


def _prefetch_images(rows, max_size_cm=1.6, max_workers=16):
    urls = list({row["image_url"] for row in rows if row.get("image_url")})

    def _fetch_and_encode(url):
        image = _resolve_image(url)
        if image is None:
            return url, None
        jpeg_bytes, size = _image_to_jpeg_bytes(image, max_size_cm)
        return url, (jpeg_bytes, size)

    cache = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(_fetch_and_encode, url): url for url in urls}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                cache[url] = future.result()[1]
            except Exception:
                cache[url] = None
    return cache


PDF_TABLE_MARGIN = 1 * cm

# Ancho relativo de cada columna (Imagen + COLUMNS); se escala para llenar
# exactamente el ancho imprimible de la página y así evitar que la tabla se
# salga del PDF en orientación landscape.
PDF_TABLE_COLUMN_WEIGHTS = (
    1.3,  # Imagen
    2.0,  # Nombre
    1.0,  # Presentación
    1.2,  # Categoría
    1.0,  # Tipo
    1.0,  # Marca
    1.3,  # SKU
    1.0,  # Precio
    1.1,  # Precio costo
    0.8,  # Margen %
    0.9,  # Estado
    0.9,  # Stock actual
    0.9,  # Stock mínimo
    1.2,  # Fecha creación
)


def _write_pdf_table(path, rows):
    image_cache = _prefetch_images(rows, max_size_cm=1.6)
    document = SimpleDocTemplate(
        str(path),
        pagesize=landscape(letter),
        leftMargin=PDF_TABLE_MARGIN,
        rightMargin=PDF_TABLE_MARGIN,
        topMargin=PDF_TABLE_MARGIN,
        bottomMargin=PDF_TABLE_MARGIN,
    )
    styles = getSampleStyleSheet()
    cell_style = styles["BodyText"]
    cell_style.fontSize = 6.5
    cell_style.leading = 8
    elements = [Paragraph("Juhnios Rold - Exportación de productos", styles["Title"]), Spacer(1, 12)]

    header = ["Imagen"] + [label for _, label in COLUMNS]
    data = [header]
    for row in rows:
        cached = image_cache.get(row["image_url"])
        cell = _make_rlimage(*cached) if cached else ""
        data.append([cell] + [Paragraph(str(row[key]), cell_style) for key, _ in COLUMNS])

    printable_width = document.width
    total_weight = sum(PDF_TABLE_COLUMN_WEIGHTS)
    col_widths = [printable_width * weight / total_weight for weight in PDF_TABLE_COLUMN_WEIGHTS]

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(table)
    document.build(elements)


def _write_pdf_catalog(path, rows):
    image_cache = _prefetch_images(rows, max_size_cm=3.5)
    document = SimpleDocTemplate(str(path), pagesize=letter, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    elements = [Paragraph("Juhnios Rold - Catálogo de productos", styles["Title"]), Spacer(1, 16)]

    label_style = styles["Normal"].clone("CardLabel")
    label_style.fontSize = 8
    name_style = styles["Heading4"].clone("CardName")
    name_style.fontSize = 10

    cards = []
    for row in rows:
        cached = image_cache.get(row["image_url"])
        image_cell = _make_rlimage(*cached, max_size_cm=3.5) if cached else Paragraph("Sin imagen", label_style)
        details = Paragraph(
            f"<b>{row['nombre']}</b>" + (f" · {row['presentacion']}" if row['presentacion'] else "") + "<br/>"
            f"SKU: {row['sku']}<br/>"
            f"Categoría: {row['categoria']}<br/>"
            f"Precio: {row['precio']}<br/>"
            f"Estado: {row['estado']}<br/>"
            f"Stock actual: {row['stock_actual']} (mín. {row['stock_minimo']})",
            label_style,
        )
        cards.append([image_cell, details])

    rows_per_table = 4
    for i in range(0, len(cards), rows_per_table):
        chunk = cards[i:i + rows_per_table]
        card_table = Table(chunk, colWidths=[4 * cm, 12 * cm])
        card_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(card_table)
        elements.append(Spacer(1, 12))

    document.build(elements)
