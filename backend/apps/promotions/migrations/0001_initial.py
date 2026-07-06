import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("catalog", "0007_productreview"),
    ]

    operations = [
        migrations.CreateModel(
            name="Promotion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                (
                    "discount_type",
                    models.CharField(
                        choices=[("PERCENTAGE", "Porcentaje"), ("FIXED_AMOUNT", "Monto fijo")], max_length=20,
                    ),
                ),
                ("discount_value", models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    "scope",
                    models.CharField(
                        choices=[("PRODUCT", "Producto"), ("VARIANT", "Variante"), ("CATEGORY", "Categoría")],
                        max_length=20,
                    ),
                ),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("priority", models.PositiveSmallIntegerField(default=0)),
                (
                    "category",
                    models.ForeignKey(
                        blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                        related_name="promotions", to="catalog.category",
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                        related_name="promotions", to="catalog.product",
                    ),
                ),
                (
                    "variant",
                    models.ForeignKey(
                        blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                        related_name="promotions", to="catalog.productvariant",
                    ),
                ),
            ],
            options={
                "ordering": ("-priority", "-created_at"),
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="promotion",
            constraint=models.CheckConstraint(
                check=(
                    models.Q(("category__isnull", True), ("product__isnull", False), ("scope", "PRODUCT"), ("variant__isnull", True))
                    | models.Q(("category__isnull", True), ("product__isnull", True), ("scope", "VARIANT"), ("variant__isnull", False))
                    | models.Q(("category__isnull", False), ("product__isnull", True), ("scope", "CATEGORY"), ("variant__isnull", True))
                ),
                name="promotion_scope_matches_single_target",
            ),
        ),
        migrations.AddConstraint(
            model_name="promotion",
            constraint=models.CheckConstraint(
                check=models.Q(("ends_at__isnull", True)) | models.Q(("ends_at__gt", models.F("starts_at"))),
                name="promotion_ends_after_starts",
            ),
        ),
    ]
