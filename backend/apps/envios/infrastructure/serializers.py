from decimal import Decimal

from rest_framework import serializers

from apps.commerce.infrastructure.models import OrderStatusHistory

from ..application.dtos import (
    ActualizarEstadoEnvioDTO,
    CrearEnvioDTO,
    RegistrarGuiaManualDTO,
)
from .models import EnvioModel, TrackingEventModel, TransportadoraModel


class TransportadoraSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransportadoraModel
        fields = (
            "id",
            "codigo",
            "nombre",
            "sitio_web",
            "tracking_url_template",
            "proveedor_externo",
            "soporta_api",
            "activa",
        )
        read_only_fields = ("id",)


class CrearEnvioSerializer(serializers.Serializer):
    pedido_id = serializers.UUIDField()
    direccion_envio = serializers.CharField(required=False, allow_blank=True)
    ciudad = serializers.CharField(required=False, allow_blank=True)
    departamento = serializers.CharField(required=False, allow_blank=True)
    pais = serializers.CharField(required=False, default="CO", max_length=2)
    codigo_postal = serializers.CharField(required=False, allow_blank=True)
    costo_envio = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        default=Decimal("0"),
        min_value=Decimal("0"),
    )
    fecha_entrega_estimada = serializers.DateTimeField(required=False, allow_null=True)

    def to_dto(self):
        return CrearEnvioDTO(**self.validated_data)


class RegistrarGuiaManualSerializer(serializers.Serializer):
    transportadora_id = serializers.UUIDField()
    numero_guia = serializers.CharField(min_length=3, max_length=120)
    tracking_url = serializers.URLField(required=False, allow_blank=True, max_length=500)
    costo_envio = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        min_value=Decimal("0"),
    )
    fecha_entrega_estimada = serializers.DateTimeField(required=False, allow_null=True)

    def validate_transportadora_id(self, value):
        if not TransportadoraModel.objects.filter(pk=value, activa=True).exists():
            raise serializers.ValidationError("La transportadora no existe o está inactiva.")
        return value

    def to_dto(self):
        return RegistrarGuiaManualDTO(**self.validated_data)


class ActualizarEstadoEnvioSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=EnvioModel.Estado.choices)
    descripcion = serializers.CharField(required=False, allow_blank=True)
    ubicacion = serializers.CharField(required=False, allow_blank=True)
    fecha_evento = serializers.DateTimeField(required=False, allow_null=True)

    def to_dto(self):
        return ActualizarEstadoEnvioDTO(**self.validated_data)


class TrackingEventSerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(source="changed_by.email", read_only=True)

    class Meta:
        model = TrackingEventModel
        fields = (
            "id",
            "estado",
            "descripcion",
            "ubicacion",
            "fecha_evento",
            "external_event_id",
            "changed_by_email",
            "created_at",
        )


class EnvioDetailSerializer(serializers.ModelSerializer):
    pedido_id = serializers.UUIDField(source="pedido.id", read_only=True)
    numero_pedido = serializers.CharField(source="pedido.number", read_only=True)
    estado_pedido = serializers.CharField(source="pedido.status", read_only=True)
    transportadora = TransportadoraSerializer(read_only=True)
    eventos = TrackingEventSerializer(many=True, read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = EnvioModel
        fields = (
            "id",
            "pedido_id",
            "numero_pedido",
            "estado_pedido",
            "transportadora",
            "numero_guia",
            "estado_envio",
            "tracking_url",
            "direccion_envio",
            "ciudad",
            "departamento",
            "pais",
            "codigo_postal",
            "costo_envio",
            "fecha_despacho",
            "fecha_entrega_estimada",
            "fecha_entrega_real",
            "proveedor_externo",
            "external_shipment_id",
            "external_label_url",
            "eventos",
            "created_by_email",
            "updated_by_email",
            "created_at",
            "updated_at",
        )


class OrderTrackingHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(source="changed_by.email", read_only=True)

    class Meta:
        model = OrderStatusHistory
        fields = ("id", "status", "notes", "changed_by_email", "created_at")


class TrackingPedidoSerializer(serializers.Serializer):
    pedido_id = serializers.UUIDField(source="id")
    numero_pedido = serializers.CharField(source="number")
    estado_pedido = serializers.CharField(source="status")
    direccion_envio = serializers.CharField(source="shipping_address")
    historial_pedido = OrderTrackingHistorySerializer(source="status_history", many=True)
    envio = serializers.SerializerMethodField()

    def get_envio(self, order):
        try:
            shipment = order.envio
        except EnvioModel.DoesNotExist:
            return None
        return EnvioDetailSerializer(shipment, context=self.context).data


class WebhookTrackingSerializer(serializers.Serializer):
    event_id = serializers.CharField(max_length=180)
    envio_id = serializers.UUIDField(required=False)
    external_shipment_id = serializers.CharField(required=False, allow_blank=True)
    estado = serializers.ChoiceField(choices=EnvioModel.Estado.choices)
    descripcion = serializers.CharField(required=False, allow_blank=True)
    ubicacion = serializers.CharField(required=False, allow_blank=True)
    fecha_evento = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get("envio_id") and not attrs.get("external_shipment_id"):
            raise serializers.ValidationError(
                "Debes enviar envio_id o external_shipment_id."
            )
        return attrs
