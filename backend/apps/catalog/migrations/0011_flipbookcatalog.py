# Generated manually for the catalog flipbook records.

import uuid
import django.core.validators
from django.db import migrations, models


INITIAL_FLIPBOOKS = [
    {
        "title": "Catálogo comercial",
        "label": "Productos Juhnios Rold",
        "description": "Portafolio general para revisar referencias, presentaciones y novedades de la marca.",
        "url": "https://heyzine.com/flip-book/5bc27eccc9.html#page/10",
        "accent_color": "#2D3A1F",
        "sort_order": 1,
        "is_active": True,
    },
    {
        "title": "Catálogo profesional",
        "label": "Línea para negocios",
        "description": "Una vista pensada para compradores, aliados y clientes que buscan ampliar su inventario.",
        "url": "https://heyzine.com/flip-book/8e41ab4a8b.html",
        "accent_color": "#8B7355",
        "sort_order": 2,
        "is_active": True,
    },
    {
        "title": "Catálogo complementario",
        "label": "Selección destacada",
        "description": "Referencias adicionales para explorar opciones por categoría y completar tu pedido.",
        "url": "https://heyzine.com/flip-book/d249fca6ef.html",
        "accent_color": "#7C2D12",
        "sort_order": 3,
        "is_active": True,
    },
]


def seed_initial_flipbooks(apps, schema_editor):
    FlipbookCatalog = apps.get_model("catalog", "FlipbookCatalog")
    for item in INITIAL_FLIPBOOKS:
        FlipbookCatalog.objects.get_or_create(url=item["url"], defaults=item)


def remove_initial_flipbooks(apps, schema_editor):
    FlipbookCatalog = apps.get_model("catalog", "FlipbookCatalog")
    FlipbookCatalog.objects.filter(url__in=[item["url"] for item in INITIAL_FLIPBOOKS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0010_productvariantimage"),
    ]

    operations = [
        migrations.CreateModel(
            name="FlipbookCatalog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("title", models.CharField(max_length=140)),
                ("label", models.CharField(blank=True, max_length=140)),
                ("description", models.TextField(blank=True)),
                ("url", models.URLField(max_length=500)),
                (
                    "accent_color",
                    models.CharField(
                        default="#2D3A1F",
                        max_length=7,
                        validators=[
                            django.core.validators.RegexValidator(
                                message="Ingresa un color hexadecimal válido, por ejemplo #2D3A1F.",
                                regex="^#[0-9A-Fa-f]{6}$",
                            )
                        ],
                    ),
                ),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ("sort_order", "title"),
            },
        ),
        migrations.RunPython(seed_initial_flipbooks, remove_initial_flipbooks),
    ]
