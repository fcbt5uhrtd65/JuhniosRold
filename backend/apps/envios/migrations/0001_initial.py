import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


SHIPMENT_STATUS_CHOICES = [
    ("PENDIENTE", "Pendiente"),
    ("GENERANDO_GUIA", "Generando guía"),
    ("GUIA_GENERADA", "Guía generada"),
    ("RECOGIDA_PROGRAMADA", "Recogida programada"),
    ("RECOGIDO", "Recogido"),
    ("EN_TRANSITO", "En tránsito"),
    ("EN_REPARTO", "En reparto"),
    ("ENTREGADO", "Entregado"),
    ("NOVEDAD", "Novedad"),
    ("DEVUELTO", "Devuelto"),
    ("CANCELADO", "Cancelado"),
]


def seed_carriers(apps, schema_editor):
    Carrier = apps.get_model("envios", "TransportadoraModel")
    carriers = [
        ("MANUAL", "Transportadora manual", "manual", False),
        ("MOCK", "Transportadora Mock", "mock", True),
        ("ENVIA", "Envia.com", "envia", True),
        ("COORDINADORA", "Coordinadora", "coordinadora", True),
        ("SERVIENTREGA", "Servientrega", "manual", False),
        ("TCC", "TCC", "manual", False),
        ("INTERRAPIDISIMO", "Inter Rapidísimo", "manual", False),
        ("99ENVIOS", "99 Envíos", "manual", False),
        ("MELONN", "Melonn", "manual", False),
    ]
    for code, name, provider, supports_api in carriers:
        Carrier.objects.get_or_create(
            codigo=code,
            defaults={
                "nombre": name,
                "proveedor_externo": provider,
                "soporta_api": supports_api,
                "activa": True,
            },
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("commerce", "0007_alter_order_status_and_history_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="TransportadoraModel",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("codigo", models.CharField(max_length=40, unique=True)),
                ("nombre", models.CharField(max_length=120)),
                ("sitio_web", models.URLField(blank=True)),
                ("tracking_url_template", models.URLField(blank=True)),
                ("proveedor_externo", models.CharField(default="manual", max_length=40)),
                ("soporta_api", models.BooleanField(default=False)),
                ("activa", models.BooleanField(default=True)),
                ("configuracion", models.JSONField(blank=True, default=dict)),
            ],
            options={"ordering": ("nombre",)},
        ),
        migrations.CreateModel(
            name="EnvioModel",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("numero_guia", models.CharField(blank=True, db_index=True, max_length=120)),
                ("estado_envio", models.CharField(choices=SHIPMENT_STATUS_CHOICES, db_index=True, default="PENDIENTE", max_length=30)),
                ("tracking_url", models.URLField(blank=True, max_length=500)),
                ("direccion_envio", models.TextField()),
                ("ciudad", models.CharField(blank=True, max_length=120)),
                ("departamento", models.CharField(blank=True, max_length=120)),
                ("pais", models.CharField(default="CO", max_length=2)),
                ("codigo_postal", models.CharField(blank=True, max_length=20)),
                ("costo_envio", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("fecha_despacho", models.DateTimeField(blank=True, null=True)),
                ("fecha_entrega_estimada", models.DateTimeField(blank=True, null=True)),
                ("fecha_entrega_real", models.DateTimeField(blank=True, null=True)),
                ("proveedor_externo", models.CharField(default="manual", max_length=40)),
                ("external_shipment_id", models.CharField(blank=True, db_index=True, max_length=160)),
                ("external_label_url", models.URLField(blank=True, max_length=500)),
                ("raw_response", models.JSONField(blank=True, default=dict)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="envios_creados", to=settings.AUTH_USER_MODEL)),
                ("pedido", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="envio", to="commerce.order")),
                ("transportadora", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="envios", to="envios.transportadoramodel")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="envios_actualizados", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="TrackingEventModel",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("estado", models.CharField(choices=SHIPMENT_STATUS_CHOICES, max_length=30)),
                ("descripcion", models.TextField(blank=True)),
                ("ubicacion", models.CharField(blank=True, max_length=255)),
                ("fecha_evento", models.DateTimeField()),
                ("raw_payload", models.JSONField(blank=True, default=dict)),
                ("external_event_id", models.CharField(blank=True, max_length=180, null=True, unique=True)),
                ("changed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="tracking_events", to=settings.AUTH_USER_MODEL)),
                ("envio", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="eventos", to="envios.enviomodel")),
            ],
            options={"ordering": ("fecha_evento", "created_at")},
        ),
        migrations.AddConstraint(
            model_name="enviomodel",
            constraint=models.UniqueConstraint(
                condition=~models.Q(numero_guia=""),
                fields=("transportadora", "numero_guia"),
                name="unique_tracking_number_per_carrier",
            ),
        ),
        migrations.AddIndex(
            model_name="enviomodel",
            index=models.Index(fields=["estado_envio", "updated_at"], name="envios_envi_estado__43fd50_idx"),
        ),
        migrations.AddIndex(
            model_name="enviomodel",
            index=models.Index(fields=["proveedor_externo", "external_shipment_id"], name="envios_envi_proveed_b4fd9d_idx"),
        ),
        migrations.AddIndex(
            model_name="trackingeventmodel",
            index=models.Index(fields=["envio", "fecha_evento"], name="envios_trac_envio_i_388073_idx"),
        ),
        migrations.AddIndex(
            model_name="trackingeventmodel",
            index=models.Index(fields=["estado", "fecha_evento"], name="envios_trac_estado_d16e5b_idx"),
        ),
        migrations.RunPython(seed_carriers, migrations.RunPython.noop),
    ]
