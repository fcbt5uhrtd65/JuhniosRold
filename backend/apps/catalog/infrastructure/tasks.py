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
from urllib.parse import urlparse
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
        if not _is_safe_public_url(image_ref):
            return None
        cache_key = hashlib.sha256(image_ref.encode()).hexdigest()
        IMAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_path = IMAGE_CACHE_DIR / cache_key
        if cache_path.exists():
            data = cache_path.read_bytes()
            return data if len(data) <= MAX_IMAGE_BYTES else None
        try:
            request = urllib.request.Request(image_ref, headers={"User-Agent": "JuhniosRold-Export/1.0"})
            with urllib.request.urlopen(request, timeout=IMAGE_DOWNLOAD_TIMEOUT) as response:
                data = response.read(MAX_IMAGE_BYTES + 1)
        except Exception:
            return None
        if len(data) <= MAX_IMAGE_BYTES:
            cache_path.write_bytes(data)
            return data
        return None

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


def _collect_rows(product_ids):
    products = (
        Product.objects.filter(id__in=product_ids)
        .select_related("category")
        .prefetch_related("variants__prices", "variants__stocks")
    )
    rows = []
    for product in products:
        variants = list(product.variants.all())
        variant = next((v for v in variants if v.is_active), variants[0] if variants else None)

        price = None
        if variant:
            prices = list(variant.prices.all())
            price = next((p for p in prices if p.is_active), prices[0] if prices else None)

        cost = variant.cost if variant else None
        amount = price.amount if price else None
        margen = None
        if amount and cost and amount > 0:
            margen = round(float((amount - cost) / amount) * 100, 2)

        stock_actual = stock_minimo = None
        if variant:
            stocks = list(variant.stocks.all())
            if stocks:
                stock_actual = sum(s.quantity for s in stocks)
                stock_minimo = sum(s.minimum_quantity for s in stocks)

        attrs = variant.attributes if variant and isinstance(variant.attributes, dict) else {}
        rows.append({
            "image_url": (variant.image_url if variant and variant.image_url else product.image_url),
            "nombre": product.name,
            "categoria": product.category.name if product.category else "",
            "tipo": attrs.get("type", ""),
            "marca": attrs.get("brand", attrs.get("marca", "")),
            "sku": variant.sku if variant else "",
            "precio": float(amount) if amount is not None else "",
            "precio_costo": float(cost) if cost is not None else "",
            "margen": margen if margen is not None else "",
            "estado": "Activo" if product.is_active else "Inactivo",
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


def _image_to_jpeg_bytes(image, max_size_cm=1.6):
    max_px = int(max_size_cm * 40)
    thumb = image.copy()
    thumb.thumbnail((max_px, max_px), PILImage.LANCZOS)
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=72, optimize=True)
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
    2.2,  # Nombre
    1.3,  # Categoría
    1.1,  # Tipo
    1.1,  # Marca
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
            f"<b>{row['nombre']}</b><br/>"
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
