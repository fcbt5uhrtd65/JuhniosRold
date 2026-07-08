from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    FlipbookCatalogViewSet,
    PriceViewSet,
    ProductCompleteCreateView,
    ProductExportStatusView,
    ProductExportView,
    ProductImageViewSet,
    ProductReviewViewSet,
    ProductVariantImageViewSet,
    ProductVariantViewSet,
    ProductViewSet,
    VariantCompleteCreateView,
)

router = DefaultRouter()
router.register("products", ProductViewSet)
router.register("categories", CategoryViewSet)
router.register("flipbooks", FlipbookCatalogViewSet)
router.register("variants", ProductVariantViewSet)
router.register("prices", PriceViewSet)
router.register("images", ProductImageViewSet)
router.register("variant-images", ProductVariantImageViewSet)
router.register("reviews", ProductReviewViewSet)

urlpatterns = [
    path("exports/", ProductExportView.as_view(), name="product-export"),
    path("exports/<str:task_id>/", ProductExportStatusView.as_view(), name="product-export-status"),
    path("products/create-complete/", ProductCompleteCreateView.as_view(), name="product-create-complete"),
    path("variants/create-complete/", VariantCompleteCreateView.as_view(), name="variant-create-complete"),
] + router.urls
