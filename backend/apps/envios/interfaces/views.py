from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from apps.commerce.infrastructure.models import Order, OrderStatusHistory

from ..application.use_cases import (
    ActualizarEstadoEnvioUseCase,
    ActualizarTrackingUseCase,
    CancelarEnvioUseCase,
    CrearEnvioUseCase,
    GenerarGuiaUseCase,
    RegistrarGuiaManualUseCase,
)
from ..infrastructure.models import EnvioModel, TrackingEventModel, TransportadoraModel
from ..infrastructure.serializers import (
    ActualizarEstadoEnvioSerializer,
    CrearEnvioSerializer,
    EnvioDetailSerializer,
    RegistrarGuiaManualSerializer,
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
