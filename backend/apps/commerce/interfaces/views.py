from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from apps.inventory.infrastructure.models import Location

from ..application.use_cases import CancelOrder, CheckoutCart
from ..infrastructure.models import Cart, CartItem, Order
from ..infrastructure.serializers import CartItemSerializer, CartSerializer, CheckoutSerializer, OrderSerializer


class CartViewSet(SoftDeleteModelViewSet):
    queryset = Cart.objects.select_related("customer").prefetch_related("items__variant")
    serializer_class = CartSerializer
    filterset_fields = ("customer", "checked_out_at")

    @action(detail=True, methods=("post",))
    def checkout(self, request, pk=None):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        location = Location.objects.get(id=serializer.validated_data["location_id"])
        order = CheckoutCart().execute(
            cart=self.get_object(),
            location=location,
            shipping_address=serializer.validated_data["shipping_address"],
            actor=request.user,
        )
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CartItemViewSet(SoftDeleteModelViewSet):
    queryset = CartItem.objects.select_related("cart", "variant")
    serializer_class = CartItemSerializer
    filterset_fields = ("cart", "variant")


class OrderViewSet(SoftDeleteModelViewSet):
    queryset = Order.objects.select_related("customer").prefetch_related("items", "status_history")
    serializer_class = OrderSerializer
    filterset_fields = ("customer", "status")
    search_fields = ("number", "customer__document_number", "tracking_number")
    ordering_fields = ("created_at", "total")

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        order = CancelOrder().execute(self.get_object(), actor=request.user)
        return Response(self.get_serializer(order).data)
