from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from apps.identity.interfaces.permissions import HasComponentAccess
from apps.inventory.infrastructure.models import Location

from ..application.services import OrderStatusService
from ..application.use_cases import ActiveCartService, CancelOrder, CheckoutCart
from .filters import PaymentFilter
from ..infrastructure.models import Cart, Order, Payment, WholesaleSettings
from ..infrastructure.serializers import (
    AddCartItemSerializer,
    AdminOrderSerializer,
    CartSerializer,
    CheckoutSerializer,
    OrderSerializer,
    PaymentAdminSerializer,
    UpdateCartItemSerializer,
    WholesaleSettingsSerializer,
)


def _customer_for(request):
    return getattr(request.user, "customer_profile", None)


def _default_location():
    return get_object_or_404(
        Location,
        warehouse__code=settings.ECOMMERCE_WAREHOUSE_CODE,
        code=settings.ECOMMERCE_LOCATION_CODE,
        is_active=True,
    )


def _cart_queryset():
    return Cart.objects.select_related("customer").prefetch_related(
        "items__variant__product__category",
        "items__variant__images",
        "items__variant__prices",
    )


class ActiveCartView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    service = ActiveCartService()

    def get(self, request):
        customer = _customer_for(request)
        if customer is None:
            return Response(
                {"detail": "El usuario no tiene un perfil de cliente."},
                status=status.HTTP_403_FORBIDDEN,
            )
        cart = self.service.get_or_create(customer)
        return Response(CartSerializer(_cart_queryset().get(pk=cart.pk)).data)

    def delete(self, request):
        customer = _customer_for(request)
        if customer is None:
            return Response(status=status.HTTP_403_FORBIDDEN)
        cart = self.service.clear(customer=customer)
        return Response(CartSerializer(_cart_queryset().get(pk=cart.pk)).data)


class ActiveCartItemCollectionView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    service = ActiveCartService()

    def post(self, request):
        serializer = AddCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = _customer_for(request)
        if customer is None:
            return Response(status=status.HTTP_403_FORBIDDEN)
        cart = self.service.add_item(customer=customer, **serializer.validated_data)
        return Response(
            CartSerializer(_cart_queryset().get(pk=cart.pk)).data,
            status=status.HTTP_201_CREATED,
        )


class ActiveCartItemDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)
    service = ActiveCartService()

    def patch(self, request, item_id):
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = _customer_for(request)
        if customer is None:
            return Response(status=status.HTTP_403_FORBIDDEN)
        cart = self.service.update_item(
            customer=customer,
            item_id=item_id,
            **serializer.validated_data,
        )
        return Response(CartSerializer(_cart_queryset().get(pk=cart.pk)).data)

    def delete(self, request, item_id):
        customer = _customer_for(request)
        if customer is None:
            return Response(status=status.HTTP_403_FORBIDDEN)
        cart = self.service.remove_item(customer=customer, item_id=item_id)
        return Response(CartSerializer(_cart_queryset().get(pk=cart.pk)).data)


class ActiveCartCheckoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = _customer_for(request)
        if customer is None:
            return Response(status=status.HTTP_403_FORBIDDEN)
        location_id = serializer.validated_data.get("location_id")
        location = (
            get_object_or_404(Location, pk=location_id, is_active=True)
            if location_id
            else _default_location()
        )
        cart = ActiveCartService.get_or_create(customer)
        order = CheckoutCart().execute(
            cart=cart,
            location=location,
            shipping_address=serializer.validated_data["shipping_address"],
            actor=request.user,
            wholesale_code=serializer.validated_data.get("wholesale_code", ""),
        )
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class WholesaleSettingsView(APIView):
    permission_classes = (permissions.IsAuthenticatedOrReadOnly,)

    def get(self, request):
        return Response(WholesaleSettingsSerializer(WholesaleSettings.current()).data)

    def patch(self, request):
        has_access = getattr(request.user, "has_component_access", lambda *_args, **_kwargs: False)
        if not has_access("commerce.orders", "edit"):
            return Response(status=status.HTTP_403_FORBIDDEN)
        instance = WholesaleSettings.current()
        serializer = WholesaleSettingsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OrderViewSet(SoftDeleteModelViewSet):
    queryset = Order.objects.select_related("customer").prefetch_related(
        "items",
        "status_history",
        "payments",
    )
    serializer_class = OrderSerializer
    filterset_fields = ("customer", "status")
    search_fields = ("number", "customer__document_number", "tracking_number")
    ordering_fields = ("created_at", "total")

    def get_serializer_class(self):
        has_access = getattr(self.request.user, "has_component_access", lambda *_args, **_kwargs: False)
        if self.action in ("update", "partial_update") and has_access("commerce.orders", "edit"):
            return AdminOrderSerializer
        return OrderSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        has_access = getattr(self.request.user, "has_component_access", lambda *_args, **_kwargs: False)
        if has_access("commerce.orders", "view"):
            return queryset
        return queryset.filter(customer__user=self.request.user)

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return (permissions.IsAuthenticated(),)
        return super().get_permissions()

    def check_permissions(self, request):
        has_access = getattr(request.user, "has_component_access", lambda *_args, **_kwargs: False)
        if self.action in ("create", "update", "partial_update", "destroy") and not has_access("commerce.orders", "edit"):
            self.permission_denied(request, message="No tienes permiso para administrar pedidos.")
        return super().check_permissions(request)

    @transaction.atomic
    def perform_update(self, serializer):
        order = self.get_object()
        previous_status = order.status
        updated_order = serializer.save()
        if updated_order.status != previous_status:
            requested_status = updated_order.status
            Order.objects.filter(pk=updated_order.pk).update(status=previous_status)
            updated_order.status = previous_status
            OrderStatusService.change(
                order=updated_order,
                status=requested_status,
                actor=self.request.user,
                notes="Estado actualizado desde la administración.",
            )

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        order = CancelOrder().execute(self.get_object(), actor=request.user)
        return Response(self.get_serializer(order).data)


class PaymentListView(generics.ListAPIView):
    queryset = Payment.objects.select_related("order", "order__customer", "invoice").order_by("-created_at")
    serializer_class = PaymentAdminSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "commerce.orders"
    filterset_class = PaymentFilter
    search_fields = ("reference", "order__number", "order__customer__first_name", "order__customer__last_name")
    ordering_fields = ("created_at", "amount_in_cents")
