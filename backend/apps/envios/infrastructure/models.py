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


class ShippingSettings(BaseModel):
    """Configuración general y única de la calculadora de costos de envío."""

    local_rate = models.DecimalField(max_digits=14, decimal_places=2, default=8000)
    regional_rate = models.DecimalField(max_digits=14, decimal_places=2, default=15000)
    national_rate = models.DecimalField(max_digits=14, decimal_places=2, default=22000)

    enable_distance_calc = models.BooleanField(default=False)
    base_rate = models.DecimalField(max_digits=14, decimal_places=2, default=6000)
    rate_per_km = models.DecimalField(max_digits=10, decimal_places=2, default=800)
    min_charge = models.DecimalField(max_digits=14, decimal_places=2, default=6000)
    max_charge = models.DecimalField(max_digits=14, decimal_places=2, default=60000)

    enable_free_shipping = models.BooleanField(default=True)
    free_shipping_threshold = models.DecimalField(max_digits=14, decimal_places=2, default=80000)

    enable_manual_quote_fallback = models.BooleanField(default=True)

    origin_address = models.CharField(max_length=255, blank=True)
    origin_city = models.CharField(max_length=120, default="Barranquilla")
    origin_department = models.CharField(max_length=120, default="Atlántico")
    origin_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    origin_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        verbose_name = "Configuración de envíos"
        verbose_name_plural = "Configuración de envíos"

    def __str__(self):
        return "Configuración de envíos"

    @classmethod
    def current(cls):
        settings_obj = cls.objects.filter(deleted_at__isnull=True).order_by("-updated_at").first()
        if settings_obj:
            return settings_obj
        return cls.objects.create(**cls._seed_from_env())

    @staticmethod
    def _seed_from_env():
        """Semilla inicial desde variables de entorno (solo aplica al crear el primer registro;
        luego de creado, la configuración vive en BD y se administra desde el panel admin)."""
        defaults = {}
        if getattr(settings, "SHIPPING_ORIGIN_ADDRESS", ""):
            defaults["origin_address"] = settings.SHIPPING_ORIGIN_ADDRESS
        if getattr(settings, "SHIPPING_ORIGIN_CITY", ""):
            defaults["origin_city"] = settings.SHIPPING_ORIGIN_CITY
        if getattr(settings, "SHIPPING_ORIGIN_DEPARTMENT", ""):
            defaults["origin_department"] = settings.SHIPPING_ORIGIN_DEPARTMENT
        if getattr(settings, "SHIPPING_ORIGIN_LAT", None) is not None:
            defaults["origin_latitude"] = settings.SHIPPING_ORIGIN_LAT
        if getattr(settings, "SHIPPING_ORIGIN_LNG", None) is not None:
            defaults["origin_longitude"] = settings.SHIPPING_ORIGIN_LNG
        defaults["enable_distance_calc"] = getattr(settings, "SHIPPING_ENABLE_DISTANCE_CALC", False)
        defaults["enable_free_shipping"] = getattr(settings, "SHIPPING_ENABLE_FREE_SHIPPING", True)
        return defaults


class ShippingZone(BaseModel):
    """Zonas especiales: recargo, cobertura, o cotización manual obligatoria por ciudad/departamento."""

    class ZoneType(models.TextChoices):
        LOCAL = "LOCAL", "Local (Barranquilla y área metropolitana)"
        REGIONAL = "REGIONAL", "Regional (resto del Atlántico)"
        NATIONAL = "NATIONAL", "Nacional (resto de Colombia)"

    name = models.CharField(max_length=120)
    zone_type = models.CharField(max_length=20, choices=ZoneType.choices, default=ZoneType.NATIONAL)
    department = models.CharField(max_length=120, blank=True, db_index=True)
    city = models.CharField(max_length=120, blank=True, db_index=True)
    surcharge = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    requires_manual_quote = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("department", "city")
        verbose_name = "Zona de envío"
        verbose_name_plural = "Zonas de envío"

    def __str__(self):
        return f"{self.name} ({self.city or self.department})"


class ShippingCalculation(BaseModel):
    """Trazabilidad del cálculo de envío aplicado a un pedido."""

    class Status(models.TextChoices):
        CALCULATED = "calculado", "Calculado"
        FREE = "gratis", "Gratis"
        PENDING_MANUAL = "pendiente_manual", "Pendiente por confirmar"
        NO_COVERAGE = "sin_cobertura", "Sin cobertura"

    class Method(models.TextChoices):
        ZONE = "ZONE", "Por ciudad/departamento"
        DISTANCE = "DISTANCE", "Por distancia"
        FREE = "FREE", "Envío gratis"
        MANUAL = "MANUAL", "Cotización manual"

    order = models.OneToOneField(
        "commerce.Order",
        on_delete=models.CASCADE,
        related_name="shipping_calculation",
        null=True,
        blank=True,
    )
    address_snapshot = models.JSONField(default=dict, blank=True)
    city = models.CharField(max_length=120, blank=True)
    department = models.CharField(max_length=120, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    distance_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.ZONE)
    zone = models.ForeignKey(ShippingZone, on_delete=models.SET_NULL, null=True, blank=True, related_name="calculations")
    shipping_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CALCULATED)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Cálculo de envío"
        verbose_name_plural = "Cálculos de envío"

    def __str__(self):
        return f"Cálculo {self.get_status_display()} - {self.shipping_cost}"
