from rest_framework.routers import DefaultRouter

from .views import InventoryMovementViewSet, LocationViewSet, StockViewSet, WarehouseViewSet

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet)
router.register("locations", LocationViewSet)
router.register("stock", StockViewSet)
router.register("movements", InventoryMovementViewSet)

urlpatterns = router.urls
