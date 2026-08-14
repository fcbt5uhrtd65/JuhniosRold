from rest_framework.routers import DefaultRouter

from .views import PromotionViewSet, SellerDiscountCodeViewSet

router = DefaultRouter()
router.register("seller-codes", SellerDiscountCodeViewSet, basename="seller-discount-code")
router.register("", PromotionViewSet, basename="promotion")

urlpatterns = router.urls
