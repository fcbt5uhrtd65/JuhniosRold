from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, PriceViewSet, ProductImageViewSet, ProductVariantViewSet, ProductViewSet

router = DefaultRouter()
router.register("products", ProductViewSet)
router.register("categories", CategoryViewSet)
router.register("variants", ProductVariantViewSet)
router.register("prices", PriceViewSet)
router.register("images", ProductImageViewSet)

urlpatterns = router.urls
