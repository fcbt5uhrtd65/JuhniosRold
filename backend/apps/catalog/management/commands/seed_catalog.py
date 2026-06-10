from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.inventory.infrastructure.models import Location, Stock, Warehouse

from ...infrastructure.models import Category, Price, Product, ProductVariant
from ...seed_data import CATEGORY_DATA, iter_catalog_items


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
            "FULL LISO",
            "FUSION AMINO",
            "GEL CAPILAR",
            "SHAMPOO",
            "ACONDICIONADOR",
            "CREMA DE PEINAR",
            "SILICONA",
            "TONO SOBRE TONO",
            "TRATAMIENTO KERATINA",
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


@transaction.atomic
def seed_catalog():
    if Product.objects.exists():
        return 0

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
    created = 0
    for item in iter_catalog_items():
        product = Product.objects.create(
            category=categories[category_slug_for(item["name"])],
            name=item["name"],
            slug=f"{slugify(item['name'])[:42]}-{item['id']:03d}",
            description="Producto del catalogo inicial de Juhnios Rold.",
            is_active=True,
            is_featured=item["id"] <= 8,
        )
        presentation = (
            "Unidad"
            if item["units_per_display"] == "N/A"
            else f"Display x {item['units_per_display']}"
        )
        variant = ProductVariant.objects.create(
            product=product,
            sku=f"JR-CAT-{item['id']:03d}",
            name=presentation,
            attributes={"units_per_display": item["units_per_display"]},
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
        created += 1

    return created


class Command(BaseCommand):
    help = "Carga el catalogo inicial si no existen productos."

    def handle(self, *args, **options):
        created = seed_catalog()
        if created:
            self.stdout.write(self.style.SUCCESS(f"Catalogo inicial cargado: {created} productos."))
        else:
            self.stdout.write("El catalogo ya contiene productos; no se realizaron cambios.")
