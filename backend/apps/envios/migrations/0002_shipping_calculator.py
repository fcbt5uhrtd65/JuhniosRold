import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("envios", "0001_initial"),
        ("commerce", "0008_wholesale_discount_and_presentation"),
    ]

    operations = [
        migrations.CreateModel(
            name="ShippingSettings",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("local_rate", models.DecimalField(decimal_places=2, default=8000, max_digits=14)),
                ("regional_rate", models.DecimalField(decimal_places=2, default=15000, max_digits=14)),
                ("national_rate", models.DecimalField(decimal_places=2, default=22000, max_digits=14)),
                ("enable_distance_calc", models.BooleanField(default=False)),
                ("base_rate", models.DecimalField(decimal_places=2, default=6000, max_digits=14)),
                ("rate_per_km", models.DecimalField(decimal_places=2, default=800, max_digits=10)),
                ("min_charge", models.DecimalField(decimal_places=2, default=6000, max_digits=14)),
                ("max_charge", models.DecimalField(decimal_places=2, default=60000, max_digits=14)),
                ("enable_free_shipping", models.BooleanField(default=True)),
                ("free_shipping_threshold", models.DecimalField(decimal_places=2, default=80000, max_digits=14)),
                ("enable_manual_quote_fallback", models.BooleanField(default=True)),
                ("origin_address", models.CharField(blank=True, max_length=255)),
                ("origin_city", models.CharField(default="Barranquilla", max_length=120)),
                ("origin_department", models.CharField(default="Atlántico", max_length=120)),
                ("origin_latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("origin_longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
            ],
            options={
                "verbose_name": "Configuración de envíos",
                "verbose_name_plural": "Configuración de envíos",
            },
        ),
        migrations.CreateModel(
            name="ShippingZone",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("name", models.CharField(max_length=120)),
                ("zone_type", models.CharField(choices=[
                    ("LOCAL", "Local (Barranquilla y área metropolitana)"),
                    ("REGIONAL", "Regional (resto del Atlántico)"),
                    ("NATIONAL", "Nacional (resto de Colombia)"),
                ], default="NATIONAL", max_length=20)),
                ("department", models.CharField(blank=True, db_index=True, max_length=120)),
                ("city", models.CharField(blank=True, db_index=True, max_length=120)),
                ("surcharge", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("requires_manual_quote", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Zona de envío",
                "verbose_name_plural": "Zonas de envío",
                "ordering": ("department", "city"),
            },
        ),
        migrations.CreateModel(
            name="ShippingCalculation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("address_snapshot", models.JSONField(blank=True, default=dict)),
                ("city", models.CharField(blank=True, max_length=120)),
                ("department", models.CharField(blank=True, max_length=120)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("distance_km", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ("method", models.CharField(choices=[
                    ("ZONE", "Por ciudad/departamento"),
                    ("DISTANCE", "Por distancia"),
                    ("FREE", "Envío gratis"),
                    ("MANUAL", "Cotización manual"),
                ], default="ZONE", max_length=20)),
                ("shipping_cost", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("status", models.CharField(choices=[
                    ("calculado", "Calculado"),
                    ("gratis", "Gratis"),
                    ("pendiente_manual", "Pendiente por confirmar"),
                    ("sin_cobertura", "Sin cobertura"),
                ], default="calculado", max_length=20)),
                ("notes", models.TextField(blank=True)),
                ("order", models.OneToOneField(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="shipping_calculation",
                    to="commerce.order",
                )),
                ("zone", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="calculations",
                    to="envios.shippingzone",
                )),
            ],
            options={
                "verbose_name": "Cálculo de envío",
                "verbose_name_plural": "Cálculos de envío",
                "ordering": ("-created_at",),
            },
        ),
    ]
