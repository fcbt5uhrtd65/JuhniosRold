from decimal import Decimal

from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import Promotion, SellerDiscountCode
from ..infrastructure.serializers import (
    PromotionSerializer,
    SellerDiscountCodeSerializer,
    SellerDiscountCodeValidationSerializer,
)


class PromotionViewSet(SoftDeleteModelViewSet):
    queryset = Promotion.objects.select_related("product", "variant", "category")
    serializer_class = PromotionSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "catalog.management"
    filterset_fields = ("scope", "is_active", "product", "variant", "category")
    search_fields = ("name",)
    ordering_fields = ("priority", "starts_at", "created_at")


class SellerDiscountCodeViewSet(SoftDeleteModelViewSet):
    queryset = SellerDiscountCode.objects.select_related("seller")
    serializer_class = SellerDiscountCodeSerializer
    required_component = "catalog.management"
    filterset_fields = ("seller", "is_active", "discount_type")
    search_fields = ("code", "name", "seller__first_name", "seller__last_name", "seller__document_number")
    ordering_fields = ("starts_at", "ends_at", "created_at", "uses_count")

    def get_permissions(self):
        if self.action == "validate":
            return (permissions.IsAuthenticated(),)
        return (HasComponentAccess(),)

    @action(detail=False, methods=("post",), url_path="validate")
    def validate(self, request):
        serializer = SellerDiscountCodeValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code_text = serializer.validated_data["code"]
        subtotal = serializer.validated_data.get("subtotal", Decimal("0"))

        code = (
            SellerDiscountCode.objects.select_related("seller")
            .filter(code=code_text, deleted_at__isnull=True)
            .first()
        )
        if code is None:
            return Response({"detail": "El codigo de descuento no existe."}, status=status.HTTP_404_NOT_FOUND)
        if not code.is_currently_active():
            return Response({"detail": "El codigo de descuento no esta vigente."}, status=status.HTTP_400_BAD_REQUEST)
        if subtotal and subtotal < code.min_order_amount:
            return Response(
                {"detail": f"Este codigo requiere una compra minima de {code.min_order_amount}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        discount_amount = code.discount_for(subtotal) if subtotal else Decimal("0.00")
        return Response(
            {
                "id": code.id,
                "code": code.code,
                "seller": code.seller_id,
                "seller_name": code.seller_name,
                "discount_type": code.discount_type,
                "discount_value": code.discount_value,
                "discount_amount": discount_amount,
                "min_order_amount": code.min_order_amount,
                "starts_at": code.starts_at,
                "ends_at": code.ends_at,
                "uses_count": code.uses_count,
                "max_uses": code.max_uses,
                "is_active": code.is_active,
            }
        )
