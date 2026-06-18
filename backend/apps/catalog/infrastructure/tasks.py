from pathlib import Path
from uuid import uuid4

from celery import shared_task
from django.conf import settings
from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Product

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
def export_products(product_ids, output_format="xlsx"):
    rows = _collect_rows(product_ids[:MAX_EXPORT_PRODUCT_IDS])

    export_dir = Path(settings.MEDIA_ROOT) / "exports" / "products"
    export_dir.mkdir(parents=True, exist_ok=True)
    filename = f"productos-{uuid4().hex}.{output_format}"
    output_path = export_dir / filename

    if output_format == "pdf":
        _write_pdf(output_path, rows)
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


def _write_pdf(path, rows):
    document = SimpleDocTemplate(str(path), pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    elements = [Paragraph("Juhnios Rold - Exportación de productos", styles["Title"]), Spacer(1, 12)]

    header = [label for _, label in COLUMNS]
    data = [header] + [[str(row[key]) for key, _ in COLUMNS] for row in rows]
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(table)
    document.build(elements)
