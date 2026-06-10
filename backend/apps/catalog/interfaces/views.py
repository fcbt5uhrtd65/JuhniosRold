from django.db.models import Prefetch
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
    queryset = Product.objects.select_related("category")
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    search_fields = ("name", "description", "variants__sku")
    ordering_fields = ("name", "created_at")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return (permissions.AllowAny(),)
        return (permissions.IsAdminUser(),)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action not in ("list", "retrieve") or self.request.user.is_authenticated:
            return queryset.prefetch_related("variants__prices", "images")

        active_variants = ProductVariant.objects.filter(is_active=True).prefetch_related(
            Prefetch("prices", queryset=Price.objects.filter(is_active=True))
        )
        return queryset.filter(is_active=True, category__is_active=True).prefetch_related(
            Prefetch("variants", queryset=active_variants),
            "images",
        )


class CategoryViewSet(SoftDeleteModelViewSet):
    queryset = Category.objects.select_related("parent")
    serializer_class = CategorySerializer
    search_fields = ("name",)

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return (permissions.AllowAny(),)
        return (permissions.IsAdminUser(),)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("list", "retrieve") and not self.request.user.is_authenticated:
            return queryset.filter(is_active=True)
        return queryset


class ProductVariantViewSet(SoftDeleteModelViewSet):
    queryset = ProductVariant.objects.select_related("product").prefetch_related("prices")
    serializer_class = ProductVariantSerializer
    permission_classes = (permissions.IsAdminUser,)
    filterset_fields = ("product", "is_active")
    search_fields = ("sku", "name", "product__name")


class PriceViewSet(SoftDeleteModelViewSet):
    queryset = Price.objects.select_related("variant")
    serializer_class = PriceSerializer
    permission_classes = (permissions.IsAdminUser,)
    filterset_fields = ("variant", "currency", "is_active")


class ProductImageViewSet(SoftDeleteModelViewSet):
    queryset = ProductImage.objects.select_related("product")
    serializer_class = ProductImageSerializer
    permission_classes = (permissions.IsAdminUser,)
    filterset_fields = ("product", "is_primary")
