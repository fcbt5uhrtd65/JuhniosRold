from django.conf import settings
from django.db import models

from shared.infrastructure.models import BaseModel


class TransportadoraModel(BaseModel):
    codigo = models.CharField(max_length=40, unique=True)
    nombre = models.CharField(max_length=120)
    sitio_web = models.URLField(blank=True)
    tracking_url_template = models.URLField(blank=True)
    proveedor_externo = models.CharField(max_length=40, default="manual")
    soporta_api = models.BooleanField(default=False)
    activa = models.BooleanField(default=True)
    configuracion = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("nombre",)

    def __str__(self):
        return self.nombre


class EnvioModel(BaseModel):
    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        GENERANDO_GUIA = "GENERANDO_GUIA", "Generando guía"
        GUIA_GENERADA = "GUIA_GENERADA", "Guía generada"
        RECOGIDA_PROGRAMADA = "RECOGIDA_PROGRAMADA", "Recogida programada"
        RECOGIDO = "RECOGIDO", "Recogido"
        EN_TRANSITO = "EN_TRANSITO", "En tránsito"
        EN_REPARTO = "EN_REPARTO", "En reparto"
        ENTREGADO = "ENTREGADO", "Entregado"
        NOVEDAD = "NOVEDAD", "Novedad"
        DEVUELTO = "DEVUELTO", "Devuelto"
        CANCELADO = "CANCELADO", "Cancelado"

    pedido = models.OneToOneField(
        "commerce.Order",
        on_delete=models.PROTECT,
        related_name="envio",
    )
    transportadora = models.ForeignKey(
        TransportadoraModel,
        on_delete=models.PROTECT,
        related_name="envios",
        null=True,
        blank=True,
    )
    numero_guia = models.CharField(max_length=120, blank=True, db_index=True)
    estado_envio = models.CharField(
        max_length=30,
        choices=Estado.choices,
        default=Estado.PENDIENTE,
        db_index=True,
    )
    tracking_url = models.URLField(max_length=500, blank=True)
    direccion_envio = models.TextField()
    ciudad = models.CharField(max_length=120, blank=True)
    departamento = models.CharField(max_length=120, blank=True)
    pais = models.CharField(max_length=2, default="CO")
    codigo_postal = models.CharField(max_length=20, blank=True)
    costo_envio = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fecha_despacho = models.DateTimeField(null=True, blank=True)
    fecha_entrega_estimada = models.DateTimeField(null=True, blank=True)
    fecha_entrega_real = models.DateTimeField(null=True, blank=True)
    proveedor_externo = models.CharField(max_length=40, default="manual")
    external_shipment_id = models.CharField(max_length=160, blank=True, db_index=True)
    external_label_url = models.URLField(max_length=500, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="envios_creados",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="envios_actualizados",
    )

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("transportadora", "numero_guia"),
                condition=~models.Q(numero_guia=""),
                name="unique_tracking_number_per_carrier",
            )
        ]
        indexes = [
            models.Index(fields=("estado_envio", "updated_at")),
            models.Index(fields=("proveedor_externo", "external_shipment_id")),
        ]

    def __str__(self):
        return f"Envío {self.pedido.number}"


class TrackingEventModel(BaseModel):
    envio = models.ForeignKey(
        EnvioModel,
        on_delete=models.CASCADE,
        related_name="eventos",
    )
    estado = models.CharField(max_length=30, choices=EnvioModel.Estado.choices)
    descripcion = models.TextField(blank=True)
    ubicacion = models.CharField(max_length=255, blank=True)
    fecha_evento = models.DateTimeField()
    raw_payload = models.JSONField(default=dict, blank=True)
    external_event_id = models.CharField(
        max_length=180,
        unique=True,
        null=True,
        blank=True,
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tracking_events",
    )

    class Meta:
        ordering = ("fecha_evento", "created_at")
        indexes = [
            models.Index(fields=("envio", "fecha_evento")),
            models.Index(fields=("estado", "fecha_evento")),
        ]

    def __str__(self):
        return f"{self.envio_id} - {self.estado}"
