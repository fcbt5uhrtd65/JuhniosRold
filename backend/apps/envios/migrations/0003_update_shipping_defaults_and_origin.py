from decimal import Decimal

from django.db import migrations, models


ORIGIN_ADDRESS = "Cl 41 #22-82, San José, Barranquilla"
ORIGIN_LAT = Decimal("10.988330")
ORIGIN_LNG = Decimal("-74.797500")


def seed_origin_and_enable_distance_calc(apps, schema_editor):
    """Actualiza la fila vigente de ShippingSettings (si existe) con el punto de
    despacho real y activa el cálculo por distancia, solo cuando el admin no ha
    configurado ya un origen propio (evita pisar una configuración manual)."""
    ShippingSettings = apps.get_model("envios", "ShippingSettings")
    for settings_obj in ShippingSettings.objects.filter(deleted_at__isnull=True):
        changed = False
        if settings_obj.origin_latitude is None or settings_obj.origin_longitude is None:
            settings_obj.origin_latitude = ORIGIN_LAT
            settings_obj.origin_longitude = ORIGIN_LNG
            changed = True
        if not settings_obj.origin_address:
            settings_obj.origin_address = ORIGIN_ADDRESS
            changed = True
        if not settings_obj.enable_distance_calc:
            settings_obj.enable_distance_calc = True
            changed = True
        if changed:
            settings_obj.save(update_fields=[
                "origin_latitude", "origin_longitude", "origin_address", "enable_distance_calc",
            ])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("envios", "0002_shipping_calculator"),
    ]

    operations = [
        migrations.AlterField(
            model_name="shippingsettings",
            name="enable_distance_calc",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="shippingsettings",
            name="base_rate",
            field=models.DecimalField(decimal_places=2, default=5000, max_digits=14),
        ),
        migrations.AlterField(
            model_name="shippingsettings",
            name="rate_per_km",
            field=models.DecimalField(decimal_places=2, default=60, max_digits=10),
        ),
        migrations.AlterField(
            model_name="shippingsettings",
            name="min_charge",
            field=models.DecimalField(decimal_places=2, default=7000, max_digits=14),
        ),
        migrations.AlterField(
            model_name="shippingsettings",
            name="max_charge",
            field=models.DecimalField(decimal_places=2, default=65000, max_digits=14),
        ),
        migrations.AlterField(
            model_name="shippingsettings",
            name="origin_address",
            field=models.CharField(blank=True, default=ORIGIN_ADDRESS, max_length=255),
        ),
        migrations.AlterField(
            model_name="shippingsettings",
            name="origin_latitude",
            field=models.DecimalField(blank=True, decimal_places=6, default=ORIGIN_LAT, max_digits=9, null=True),
        ),
        migrations.AlterField(
            model_name="shippingsettings",
            name="origin_longitude",
            field=models.DecimalField(blank=True, decimal_places=6, default=ORIGIN_LNG, max_digits=9, null=True),
        ),
        migrations.RunPython(seed_origin_and_enable_distance_calc, noop_reverse),
    ]
