import uuid

import django.conf
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(django.conf.settings.AUTH_USER_MODEL),
        ("employees", "0013_employee_is_salesperson"),
        ("promotions", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SellerDiscountCode",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("code", models.CharField(blank=True, max_length=40, unique=True)),
                ("name", models.CharField(blank=True, max_length=120)),
                (
                    "discount_type",
                    models.CharField(choices=[("PERCENTAGE", "Porcentaje"), ("FIXED_AMOUNT", "Monto fijo")], max_length=20),
                ),
                ("discount_value", models.DecimalField(decimal_places=2, max_digits=10)),
                ("min_order_amount", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField()),
                ("max_uses", models.PositiveIntegerField(blank=True, null=True)),
                ("uses_count", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_seller_discount_codes",
                        to=django.conf.settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "seller",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="seller_discount_codes",
                        to="employees.employee",
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="sellerdiscountcode",
            constraint=models.CheckConstraint(
                check=models.Q(("ends_at__gt", models.F("starts_at"))),
                name="seller_discount_code_ends_after_starts",
            ),
        ),
        migrations.AddConstraint(
            model_name="sellerdiscountcode",
            constraint=models.CheckConstraint(
                check=models.Q(("max_uses__isnull", True)) | models.Q(("max_uses__gt", 0)),
                name="seller_discount_code_max_uses_positive",
            ),
        ),
    ]
