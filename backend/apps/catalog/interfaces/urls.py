from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    PriceViewSet,
    ProductExportStatusView,
    ProductExportView,
    ProductImageViewSet,
    ProductVariantViewSet,
    ProductViewSet,
)

router = DefaultRouter()
router.register("products", ProductViewSet)
router.register("categories", CategoryViewSet)
router.register("variants", ProductVariantViewSet)
router.register("prices", PriceViewSet)
router.register("images", ProductImageViewSet)

urlpatterns = [
    path("exports/", ProductExportView.as_view(), name="product-export"),
    path("exports/<str:task_id>/", ProductExportStatusView.as_view(), name="product-export-status"),
] + router.urls
