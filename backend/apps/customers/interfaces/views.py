from rest_framework.decorators import action
from rest_framework.response import Response

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import Customer, CustomerContact, CustomerSegment
from ..infrastructure.serializers import (
    CustomerContactSerializer,
    CustomerSegmentSerializer,
    CustomerSerializer,
)
from .filters import CustomerFilter


class CustomerViewSet(SoftDeleteModelViewSet):
    queryset = Customer.objects.prefetch_related("contacts", "segments")
    serializer_class = CustomerSerializer
    filterset_class = CustomerFilter
    search_fields = ("document_number", "first_name", "last_name", "email", "phone")
    ordering_fields = ("created_at", "first_name", "last_name")

    @action(detail=True, methods=("get",), url_path="purchase-history")
    def purchase_history(self, request, pk=None):
        customer = self.get_object()
        orders = customer.orders.values("id", "number", "status", "total", "created_at")
        return Response(orders)


class CustomerContactViewSet(SoftDeleteModelViewSet):
    queryset = CustomerContact.objects.select_related("customer")
    serializer_class = CustomerContactSerializer
    filterset_fields = ("customer", "is_primary")


class CustomerSegmentViewSet(SoftDeleteModelViewSet):
    queryset = CustomerSegment.objects.all()
    serializer_class = CustomerSegmentSerializer
    search_fields = ("name",)
