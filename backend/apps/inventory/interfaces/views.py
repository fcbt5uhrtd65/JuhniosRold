from django.db.models import F
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import InventoryMovement, Location, Stock, Warehouse
from ..infrastructure.serializers import (
    InventoryMovementSerializer,
    LocationSerializer,
    StockSerializer,
    WarehouseSerializer,
)


class WarehouseViewSet(SoftDeleteModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    search_fields = ("name", "code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class LocationViewSet(SoftDeleteModelViewSet):
    queryset = Location.objects.select_related("warehouse")
    serializer_class = LocationSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    filterset_fields = ("warehouse", "is_active")
    search_fields = ("name", "code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class StockViewSet(SoftDeleteModelViewSet):
    queryset = Stock.objects.select_related("variant__product", "location__warehouse")
    serializer_class = StockSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    filterset_fields = ("variant", "location", "location__warehouse")
    search_fields = ("variant__sku", "variant__product__name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve", "critical"} else "edit"
        return super().get_permissions()

    @action(detail=False, methods=("get",), url_path="critical")
    def critical(self, request):
        queryset = self.filter_queryset(self.get_queryset().filter(quantity__lte=F("minimum_quantity")))
        return Response(self.get_serializer(queryset, many=True).data)


class InventoryMovementViewSet(SoftDeleteModelViewSet):
    queryset = InventoryMovement.objects.select_related("variant", "location", "created_by")
    serializer_class = InventoryMovementSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("variant", "location", "movement_type")
    ordering_fields = ("created_at", "quantity")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()
