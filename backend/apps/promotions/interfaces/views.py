from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
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
    """CRUD de códigos de descuento por vendedor.

    Un administrador (``has_full_access``) puede gestionar el código de
    cualquier vendedor. Un vendedor sin ese privilegio solo puede ver,
    crear y regenerar el código asociado a su propio registro de empleado
    (``request.user.employee_profile``) — nunca el de otro vendedor, aunque
    tenga acceso al componente ``catalog.management``.
    """

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

    def _own_employee(self):
        user = self.request.user
        try:
            employee = user.employee_profile
        except ObjectDoesNotExist:
            employee = None
        if employee is None:
            raise PermissionDenied("Tu usuario no tiene un registro de empleado asociado.")
        return employee

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "has_full_access", False):
            return queryset
        return queryset.filter(seller=self._own_employee())

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "has_full_access", False):
            serializer.save()
            return
        serializer.save(seller=self._own_employee())

    def perform_update(self, serializer):
        user = self.request.user
        if getattr(user, "has_full_access", False):
            serializer.save()
            return
        # Un vendedor solo puede editar su propio código; nunca reasignarlo a otro.
        serializer.save(seller=self._own_employee())

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
