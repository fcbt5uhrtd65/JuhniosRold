from celery.result import AsyncResult
from django.db.models import Prefetch
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from apps.inventory.infrastructure.models import Stock
from ..infrastructure.models import (
    Category,
    Price,
    Product,
    ProductImage,
    ProductReview,
    ProductVariant,
    ProductVariantImage,
)
from ..infrastructure.serializers import (
    CategorySerializer,
    CompleteProductSerializer,
    CompleteVariantSerializer,
    PriceSerializer,
    ProductImageSerializer,
    ProductReviewSerializer,
    ProductSerializer,
    ProductVariantImageSerializer,
    ProductVariantSerializer,
)
from .permissions import IsReviewOwnerOrReadOnly
from ..infrastructure.tasks import export_products
from .export_serializers import ProductExportRequestSerializer
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
            Prefetch("prices", queryset=Price.objects.filter(is_active=True)),
            Prefetch("stocks", queryset=Stock.objects.all(), to_attr="_prefetched_stocks"),
        )
        return queryset.filter(is_active=True, category__is_active=True).prefetch_related(
            Prefetch("variants", queryset=active_variants),
            "images",
        )


class ProductCompleteCreateView(generics.GenericAPIView):
    """Crea Product + ProductVariant + Price en una sola transacción atómica.

    Reemplaza el flujo de 3 POSTs secuenciales del frontend (producto, luego
    variante, luego precio) que dejaba productos huérfanos en la base de datos
    cuando la variante o el precio fallaban (p.ej. SKU duplicado) después de
    que el producto ya se había creado.
    """

    serializer_class = CompleteProductSerializer
    permission_classes = (permissions.IsAdminUser,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response(ProductSerializer(product).data, status=201)


class VariantCompleteCreateView(generics.GenericAPIView):
    """Agrega una ProductVariant + Price a un producto existente en una sola
    transacción atómica, para permitir registrar nuevas presentaciones
    (ej. 50 ML, 120 ML) sobre un producto que ya tiene al menos una variante."""

    serializer_class = CompleteVariantSerializer
    permission_classes = (permissions.IsAdminUser,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variant = serializer.save()
        return Response(ProductVariantSerializer(variant).data, status=201)


class ProductExportView(generics.GenericAPIView):
    serializer_class = ProductExportRequestSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "catalog.management"
    required_component_action = "view"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = export_products.delay(
            [str(pid) for pid in serializer.validated_data["product_ids"]],
            serializer.validated_data["format"],
            serializer.validated_data["pdf_layout"],
        )
        return Response({"task_id": task.id, "status": "queued"}, status=202)


class ProductExportStatusView(APIView):
    permission_classes = (HasComponentAccess,)
    required_component = "catalog.management"
    required_component_action = "view"

    def get(self, request, task_id):
        result = AsyncResult(task_id)
        if result.successful():
            payload = result.result or {}
            return Response({"status": "success", "url": payload.get("url"), "count": payload.get("count")})
        if result.failed():
            return Response({"status": "failure", "error": str(result.result)})
        return Response({"status": "pending"})


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
    queryset = ProductVariant.objects.select_related("product").prefetch_related("prices", "images")
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


class ProductVariantImageViewSet(SoftDeleteModelViewSet):
    queryset = ProductVariantImage.objects.select_related("variant")
    serializer_class = ProductVariantImageSerializer
    permission_classes = (permissions.IsAdminUser,)
    filterset_fields = ("variant", "is_primary")


class ProductReviewViewSet(SoftDeleteModelViewSet):
    queryset = ProductReview.objects.select_related("user", "product")
    serializer_class = ProductReviewSerializer
    filterset_fields = ("product", "rating")
    ordering_fields = ("created_at", "rating")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return (permissions.AllowAny(),)
        if self.action == "create":
            return (permissions.IsAuthenticated(),)
        return (permissions.IsAuthenticated(), IsReviewOwnerOrReadOnly())
