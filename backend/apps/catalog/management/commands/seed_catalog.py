import hashlib
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db.models import ProtectedError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.inventory.infrastructure.models import Location, Stock, Warehouse

from ...infrastructure.models import Category, Price, Product, ProductVariant
from ...infrastructure.tasks import IMAGE_CACHE_DIR
from ...seed_data import CATEGORY_DATA, iter_catalog_items


PRESENTATION_PATTERN = re.compile(r"(?P<number>\d+(?:[.,]\d+)?)\s*(?P<unit>ML|GR|G|KG)\b")
PRESENTATION_IN_NAME_PATTERN = re.compile(r"\s+\d+(?:[.,]\d+)?\s*(?:ML|GR|G|KG)\b")


def _warm_image_cache(urls):
    unique_urls = list(set(u for u in urls if u and u.startswith("http")))
    IMAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _fetch(url):
        cache_key = hashlib.sha256(url.encode()).hexdigest()
        cache_path = IMAGE_CACHE_DIR / cache_key
        if cache_path.exists():
            return url, True
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "JuhniosRold-Export/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = resp.read(5 * 1024 * 1024 + 1)
            if len(data) <= 5 * 1024 * 1024:
                cache_path.write_bytes(data)
            return url, True
        except Exception:
            return url, False

    with ThreadPoolExecutor(max_workers=16) as executor:
        list(executor.map(_fetch, unique_urls))


def category_slug_for(name):
    normalized = name.upper()
    if "RECOLECTOR" in normalized:
        return "laboratorio"
    if "GEL ANTIBACTERIAL" in normalized:
        return "antibacterial"
    if "BEBE" in normalized:
        return "baby"
    if any(
        keyword in normalized
        for keyword in (
            "ACEITES",
            "ACEITE CAPILAR",
            "ACEITE DE AGUACATE",
            "FULL LISO",
            "FUSION AMINO",
            "GEL CAPILAR",
            "SHAMPOO",
            "ACONDICIONADOR",
            "CREMA DE PEINAR",
            "SILICONA",
            "TONO SOBRE TONO",
            "MASCARILLA",
            "TRATAMIENTO KERATINA",
            "TRATAMIENTO NUTRITIVO",
            "TRATAMIENTO CAPILAR",
            "ACEITE ES 3 MAS",
        )
    ):
        return "capilar"
    if any(
        keyword in normalized
        for keyword in (
            "ACEITE CORPORAL",
            "BODY SPLASH",
            "CREMA PARA MANOS",
            "LOCION",
            "MENTHUS",
            "POMADA",
            "VASELINA",
        )
    ):
        return "corporal"
    if any(keyword in normalized for keyword in ("DESODORANTE", "REMOVEDOR")):
        return "personal"
    return "aseo"


def presentation_fields_for(name):
    normalized = name.upper()
    match = PRESENTATION_PATTERN.search(normalized)
    if match:
        unit = match.group("unit")
        return Decimal(match.group("number").replace(",", ".")), "GR" if unit == "G" else unit
    if "GALON" in normalized:
        return Decimal("3750"), "ML"
    if "PIMPINA" in normalized:
        return Decimal("20000"), "ML"
    return None, ""


def product_name_for(name):
    normalized = name.upper()
    base_name = PRESENTATION_IN_NAME_PATTERN.sub("", normalized)
    base_name = re.sub(r"\s+(GALON|PIMPINA)$", "", base_name)
    return re.sub(r"\s{2,}", " ", base_name).strip()


def _replace_seed_catalog():
    seeded_variants = ProductVariant.all_objects.filter(sku__startswith="JR-CAT-")
    product_ids = list(seeded_variants.order_by().values_list("product_id", flat=True).distinct())
    if not product_ids:
        return {"products": 0, "variants": 0, "stocks": 0}

    stock_count, _ = Stock.all_objects.filter(variant__in=seeded_variants).delete()
    variant_count = seeded_variants.count()
    product_count = len(product_ids)
    Product.all_objects.filter(id__in=product_ids).delete()
    return {"products": product_count, "variants": variant_count, "stocks": stock_count}


@transaction.atomic
def seed_catalog(replace=False):
    replaced = None
    if replace:
        replaced = _replace_seed_catalog()
    elif Product.objects.exists():
        return 0, None

    categories = {}
    for slug, data in CATEGORY_DATA.items():
        category, _ = Category.all_objects.update_or_create(
            slug=slug,
            defaults={
                "name": data["name"],
                "image_url": data["image_url"],
                "is_active": True,
                "deleted_at": None,
            },
        )
        categories[slug] = category

    warehouse, _ = Warehouse.all_objects.update_or_create(
        code="PRINCIPAL",
        defaults={
            "name": "Bodega principal",
            "address": "",
            "is_active": True,
            "deleted_at": None,
        },
    )
    location, _ = Location.all_objects.update_or_create(
        warehouse=warehouse,
        code="CATALOGO",
        defaults={
            "name": "Inventario inicial",
            "is_active": True,
            "deleted_at": None,
        },
    )

    now = timezone.now()
    created_products = 0
    products = {}
    for item in iter_catalog_items():
        product_name = product_name_for(item["name"])
        product = products.get(product_name)
        if product is None:
            product = Product.objects.create(
                category=categories[category_slug_for(item["name"])],
                name=product_name,
                slug=f"{slugify(product_name)[:42]}-{item['id']:03d}",
                description="Producto del catalogo inicial de Juhnios Rold.",
                image_url=item.get("image_url", ""),
                is_active=True,
                is_featured=item["id"] <= 8,
            )
            products[product_name] = product
            created_products += 1
        if item["units_per_display"] == "N/A":
            presentation = "Unidad"
        elif item["units_per_display"] == "DISPLAY":
            presentation = "Kit"
        else:
            presentation = f"Display x {item['units_per_display']}"
        presentation_number, presentation_unit = presentation_fields_for(item["name"])
        variant = ProductVariant.objects.create(
            product=product,
            sku=f"JR-CAT-{item['id']:03d}",
            name=presentation,
            presentation_number=presentation_number,
            presentation_unit=presentation_unit,
            image_url=item.get("image_url", ""),
            attributes={
                "catalog_name": item["name"],
                "units_per_display": item["units_per_display"],
                "units_per_box": item["stock"],
            },
            cost=0,
            is_active=True,
        )
        Price.objects.create(
            variant=variant,
            amount=item["price"],
            currency="COP",
            valid_from=now,
            is_active=True,
        )
        Stock.objects.create(
            variant=variant,
            location=location,
            quantity=item["stock"],
            minimum_quantity=0,
        )

    all_image_urls = [item.get("image_url", "") for item in iter_catalog_items()]
    category_image_urls = [data["image_url"] for data in CATEGORY_DATA.values()]
    _warm_image_cache(all_image_urls + category_image_urls)

    return created_products, replaced


class Command(BaseCommand):
    help = "Carga el catalogo inicial si no existen productos."

    def add_arguments(self, parser):
        parser.add_argument("--warm-cache", action="store_true", help="Precarga imágenes en cache sin recrear el catálogo.")
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Reemplaza únicamente los productos creados por este seed (SKU JR-CAT-*).",
        )

    def handle(self, *args, **options):
        if options["warm_cache"] and options["replace"]:
            raise CommandError("No puedes usar --warm-cache y --replace al mismo tiempo.")

        if options["warm_cache"]:
            urls = [p.image_url for p in Product.objects.exclude(image_url="")]
            urls += [data["image_url"] for data in CATEGORY_DATA.values()]
            _warm_image_cache(urls)
            self.stdout.write(self.style.SUCCESS(f"Cache de imágenes precargado ({len(set(urls))} URLs únicas)."))
            return

        try:
            created, replaced = seed_catalog(replace=options["replace"])
        except ProtectedError as exc:
            raise CommandError(
                "No se pudo reemplazar el catálogo porque existen pedidos, carritos, "
                "movimientos de inventario u otros registros históricos asociados a productos del seed."
            ) from exc

        if replaced is not None:
            self.stdout.write(
                self.style.WARNING(
                    "Catalogo anterior removido: "
                    f"{replaced['products']} productos, {replaced['variants']} variantes, {replaced['stocks']} stocks."
                )
            )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Catalogo inicial cargado: {created} productos."))
        else:
            self.stdout.write("El catalogo ya contiene productos; no se realizaron cambios.")
