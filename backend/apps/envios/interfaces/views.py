import logging

from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from apps.commerce.infrastructure.models import Order, OrderStatusHistory

from ..application.use_cases import (
    ActualizarEstadoEnvioUseCase,
    ActualizarTrackingUseCase,
    CalculateShippingCost,
    CancelarEnvioUseCase,
    CrearEnvioUseCase,
    GenerarGuiaUseCase,
    RegistrarGuiaManualUseCase,
    ShippingQuoteInput,
)
from ..infrastructure.models import (
    EnvioModel,
    ShippingSettings,
    ShippingZone,
    TrackingEventModel,
    TransportadoraModel,
)
from ..infrastructure.serializers import (
    ActualizarEstadoEnvioSerializer,
    CrearEnvioSerializer,
    EnvioDetailSerializer,
    RegistrarGuiaManualSerializer,
    ShippingQuoteRequestSerializer,
    ShippingQuoteResponseSerializer,
    ShippingSettingsSerializer,
    ShippingZoneSerializer,
    TrackingPedidoSerializer,
    TransportadoraSerializer,
)
from .permissions import (
    CanManageShipping,
    CanRegisterManualGuide,
    IsShipmentOwnerOrOperator,
)


class TransportadoraViewSet(SoftDeleteModelViewSet):
    queryset = TransportadoraModel.objects.all()
    serializer_class = TransportadoraSerializer
    filterset_fields = ("activa", "soporta_api", "proveedor_externo")
    search_fields = ("codigo", "nombre")

    def get_permissions(self):
        if self.action in {"list", "retrieve", "create", "update", "partial_update", "destroy"}:
            return (CanManageShipping(),)
        return (permissions.IsAuthenticated(),)


class EnvioViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EnvioDetailSerializer
    permission_classes = (permissions.IsAuthenticated, IsShipmentOwnerOrOperator)
    filterset_fields = ("estado_envio", "transportadora", "proveedor_externo")
    search_fields = ("pedido__number", "numero_guia", "external_shipment_id")
    ordering_fields = ("created_at", "updated_at", "fecha_entrega_estimada")

    def get_queryset(self):
        queryset = EnvioModel.objects.select_related(
            "pedido",
            "pedido__customer",
            "transportadora",
            "created_by",
            "updated_by",
        ).prefetch_related("eventos", "eventos__changed_by")
        user = self.request.user
        has_access = getattr(user, "has_component_access", lambda *_args, **_kwargs: False)
        if has_access("envios.management", "view"):
            return queryset
        return queryset.filter(pedido__customer__user=user)

    def create(self, request, *args, **kwargs):
        self.check_permissions(request)
        serializer = CrearEnvioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        envio = CrearEnvioUseCase().execute(serializer.to_dto(), actor=request.user)
        return Response(
            self.get_serializer(envio).data,
            status=status.HTTP_201_CREATED,
        )

    def get_permissions(self):
        if self.action in {"create", "estado", "generar_guia", "cancelar"}:
            return (CanManageShipping(),)
        if self.action == "registrar_guia_manual":
            return (CanRegisterManualGuide(),)
        if self.action == "actualizar_tracking":
            return (CanManageShipping(),)
        return super().get_permissions()

    @action(detail=True, methods=("put",), url_path="estado")
    def estado(self, request, pk=None):
        serializer = ActualizarEstadoEnvioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        envio = ActualizarEstadoEnvioUseCase().execute(
            envio_id=self.get_object().id,
            dto=serializer.to_dto(),
            actor=request.user,
        )
        return Response(self.get_serializer(envio).data)

    @action(detail=True, methods=("post",), url_path="registrar-guia-manual")
    def registrar_guia_manual(self, request, pk=None):
        serializer = RegistrarGuiaManualSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        envio = RegistrarGuiaManualUseCase().execute(
            envio_id=self.get_object().id,
            dto=serializer.to_dto(),
            actor=request.user,
        )
        return Response(self.get_serializer(envio).data)

    @action(detail=True, methods=("post",), url_path="generar-guia")
    def generar_guia(self, request, pk=None):
        envio = GenerarGuiaUseCase().execute(
            envio_id=self.get_object().id,
            actor=request.user,
            provider=request.data.get("provider"),
        )
        return Response(self.get_serializer(envio).data)

    @action(detail=True, methods=("get",), url_path="tracking")
    def tracking(self, request, pk=None):
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=("post",), url_path="actualizar-tracking")
    def actualizar_tracking(self, request, pk=None):
        envio = ActualizarTrackingUseCase().execute(
            envio_id=self.get_object().id,
            actor=request.user,
        )
        return Response(self.get_serializer(envio).data)

    @action(detail=True, methods=("post",))
    def cancelar(self, request, pk=None):
        envio = CancelarEnvioUseCase().execute(
            envio_id=self.get_object().id,
            actor=request.user,
        )
        return Response(self.get_serializer(envio).data)


class PedidoTrackingView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pedido_id):
        queryset = Order.objects.select_related("customer", "customer__user").prefetch_related(
            Prefetch(
                "status_history",
                queryset=OrderStatusHistory.objects.select_related("changed_by").order_by(
                    "created_at"
                ),
            ),
            Prefetch(
                "envio__eventos",
                queryset=TrackingEventModel.objects.select_related("changed_by").order_by(
                    "fecha_evento", "created_at"
                ),
            ),
        )
        order = get_object_or_404(queryset, pk=pedido_id)
        has_access = getattr(request.user, "has_component_access", lambda *_args, **_kwargs: False)
        is_operator = has_access("envios.tracking", "view")
        if not is_operator and order.customer.user_id != request.user.id:
            self.permission_denied(
                request,
                message="No tienes permiso para consultar este pedido.",
            )
        return Response(TrackingPedidoSerializer(order, context={"request": request}).data)


class ShippingSettingsView(APIView):
    """Configuración de la calculadora de envíos. Lectura pública, edición solo admin/operativo."""

    def get_permissions(self):
        if self.request.method == "GET":
            return (permissions.AllowAny(),)
        return (CanManageShipping(),)

    def get(self, request):
        return Response(ShippingSettingsSerializer(ShippingSettings.current()).data)

    def patch(self, request):
        instance = ShippingSettings.current()
        serializer = ShippingSettingsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ShippingZoneViewSet(SoftDeleteModelViewSet):
    queryset = ShippingZone.objects.all()
    serializer_class = ShippingZoneSerializer
    filterset_fields = ("zone_type", "department", "city", "is_active", "requires_manual_quote")
    search_fields = ("name", "department", "city")

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return (permissions.AllowAny(),)
        return (CanManageShipping(),)


class ShippingQuoteView(APIView):
    """Cotización pública de envío. El backend siempre recalcula: no confía en costos enviados por el cliente."""

    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ShippingQuoteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        quote_input = ShippingQuoteInput(
            city=data.get("city") or "",
            department=data.get("department") or "",
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            subtotal=data.get("subtotal") or 0,
        )
        try:
            result = CalculateShippingCost().execute(quote_input)
        except Exception:
            logger.exception("Error calculando costo de envío para %s/%s", quote_input.city, quote_input.department)
            return Response(
                {
                    "status": "sin_cobertura",
                    "method": "MANUAL",
                    "shipping_cost": "0",
                    "distance_km": None,
                    "message": "No fue posible calcular el envío en este momento.",
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            ShippingQuoteResponseSerializer(
                {
                    "status": result.status,
                    "method": result.method,
                    "shipping_cost": result.shipping_cost,
                    "distance_km": result.distance_km,
                    "message": result.message,
                }
            ).data
        )
