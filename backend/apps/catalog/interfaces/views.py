from rest_framework import permissions

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import Category, Price, Product, ProductImage, ProductVariant
from ..infrastructure.serializers import (
    CategorySerializer,
    PriceSerializer,
    ProductImageSerializer,
    ProductSerializer,
    ProductVariantSerializer,
)
from .filters import ProductFilter


class ProductViewSet(SoftDeleteModelViewSet):
    queryset = Product.objects.select_related("category").prefetch_related("variants__prices", "images")
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    search_fields = ("name", "description", "variants__sku")
    ordering_fields = ("name", "created_at")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return (permissions.AllowAny(),)
        return super().get_permissions()


class CategoryViewSet(SoftDeleteModelViewSet):
    queryset = Category.objects.select_related("parent")
    serializer_class = CategorySerializer
    search_fields = ("name",)


class ProductVariantViewSet(SoftDeleteModelViewSet):
    queryset = ProductVariant.objects.select_related("product").prefetch_related("prices")
    serializer_class = ProductVariantSerializer
    filterset_fields = ("product", "is_active")
    search_fields = ("sku", "name", "product__name")


class PriceViewSet(SoftDeleteModelViewSet):
    queryset = Price.objects.select_related("variant")
    serializer_class = PriceSerializer
    filterset_fields = ("variant", "currency", "is_active")


class ProductImageViewSet(SoftDeleteModelViewSet):
    queryset = ProductImage.objects.select_related("product")
    serializer_class = ProductImageSerializer
    filterset_fields = ("product", "is_primary")
