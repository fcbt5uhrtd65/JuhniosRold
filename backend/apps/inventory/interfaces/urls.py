from rest_framework.routers import DefaultRouter

from .views import (
    FormulaViewSet,
    InventoryMovementViewSet,
    ItemGroupViewSet,
    ItemTypeViewSet,
    ItemViewSet,
    LocationViewSet,
    ProductionOrderViewSet,
    PurchaseOrderViewSet,
    StockConversionViewSet,
    StockViewSet,
    SupplierViewSet,
    UnitOfMeasureViewSet,
    WarehouseViewSet,
)

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet)
router.register("locations", LocationViewSet)
router.register("stock", StockViewSet)
router.register("movements", InventoryMovementViewSet)
router.register("units", UnitOfMeasureViewSet)
router.register("item-groups", ItemGroupViewSet)
router.register("item-types", ItemTypeViewSet)
router.register("suppliers", SupplierViewSet)
router.register("items", ItemViewSet)
router.register("purchase-orders", PurchaseOrderViewSet)
router.register("formulas", FormulaViewSet)
router.register("production-orders", ProductionOrderViewSet)
router.register("conversions", StockConversionViewSet)

urlpatterns = router.urls
