from django.db.models import F
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import (
    Formula,
    InventoryMovement,
    Item,
    ItemGroup,
    ItemType,
    Location,
    ProductionOrder,
    PurchaseOrder,
    Stock,
    StockConversion,
    Supplier,
    UnitOfMeasure,
    Warehouse,
)
from ..infrastructure.serializers import (
    FormulaSerializer,
    InventoryMovementSerializer,
    ItemGroupSerializer,
    ItemSerializer,
    ItemTypeSerializer,
    LocationSerializer,
    ProductionOrderSerializer,
    PurchaseOrderSerializer,
    StockConversionSerializer,
    StockSerializer,
    SupplierSerializer,
    UnitOfMeasureSerializer,
    WarehouseSerializer,
)


class HasAnyComponentAccess(HasComponentAccess):
    """Allows a view to accept one or more component codes without broadening the route."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        action = getattr(view, "required_component_action", "")
        if not action:
            action = "view" if request.method in {"GET", "HEAD", "OPTIONS"} else "edit"

        if getattr(user, "has_full_access", False):
            return True

        component_codes = [getattr(view, "required_component", "")]
        component_codes.extend(getattr(view, "alternate_required_components", ()))
        alternate_actions = getattr(view, "alternate_required_component_actions", None)

        for index, component_code in enumerate(component_codes):
            if not component_code:
                continue
            if index > 0 and alternate_actions is not None and action not in alternate_actions:
                continue
            if user.has_component_access(component_code, action):
                return True
        return False


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


class UnitOfMeasureViewSet(SoftDeleteModelViewSet):
    queryset = UnitOfMeasure.objects.all()
    serializer_class = UnitOfMeasureSerializer
    permission_classes = (HasAnyComponentAccess,)
    required_component = "inventory.management"
    alternate_required_components = ("manufacturing.management",)
    alternate_required_component_actions = ("view",)
    search_fields = ("name", "code", "abbreviation")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class ItemGroupViewSet(SoftDeleteModelViewSet):
    queryset = ItemGroup.objects.all()
    serializer_class = ItemGroupSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    search_fields = ("name", "code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class ItemTypeViewSet(SoftDeleteModelViewSet):
    queryset = ItemType.objects.all()
    serializer_class = ItemTypeSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    search_fields = ("name",)

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class SupplierViewSet(SoftDeleteModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    search_fields = ("name", "nit", "contact_name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class ItemViewSet(SoftDeleteModelViewSet):
    queryset = Item.objects.select_related("item_type", "item_group", "unit", "supplier")
    serializer_class = ItemSerializer
    permission_classes = (HasAnyComponentAccess,)
    required_component = "inventory.management"
    alternate_required_components = ("manufacturing.management",)
    alternate_required_component_actions = ("view",)
    filterset_fields = ("item_type", "item_group", "supplier", "is_active")
    search_fields = ("code", "name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class PurchaseOrderViewSet(SoftDeleteModelViewSet):
    queryset = PurchaseOrder.objects.select_related("supplier", "destination_location").prefetch_related("lines")
    serializer_class = PurchaseOrderSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    filterset_fields = ("supplier", "status")
    search_fields = ("number",)

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class FormulaViewSet(SoftDeleteModelViewSet):
    queryset = Formula.objects.select_related("output_item", "yield_unit").prefetch_related("lines")
    serializer_class = FormulaSerializer
    permission_classes = (HasAnyComponentAccess,)
    required_component = "inventory.management"
    alternate_required_components = ("manufacturing.management",)
    filterset_fields = ("output_item", "is_active")
    search_fields = ("code", "name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class ProductionOrderViewSet(SoftDeleteModelViewSet):
    queryset = ProductionOrder.objects.select_related("formula", "output_item")
    serializer_class = ProductionOrderSerializer
    permission_classes = (HasAnyComponentAccess,)
    required_component = "inventory.management"
    alternate_required_components = ("manufacturing.management",)
    filterset_fields = ("formula", "output_item", "status")
    search_fields = ("number", "batch_code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class StockConversionViewSet(SoftDeleteModelViewSet):
    queryset = StockConversion.objects.select_related(
        "source_item", "source_location", "target_item", "target_location", "created_by"
    )
    serializer_class = StockConversionSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "inventory.management"
    filterset_fields = ("source_item", "target_item")
    search_fields = ("number", "reason")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


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
