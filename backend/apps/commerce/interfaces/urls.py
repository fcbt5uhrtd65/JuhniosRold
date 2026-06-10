from rest_framework.routers import DefaultRouter

from .views import CartItemViewSet, CartViewSet, OrderViewSet

router = DefaultRouter()
router.register("carts", CartViewSet)
router.register("cart-items", CartItemViewSet)
router.register("orders", OrderViewSet)

urlpatterns = router.urls
