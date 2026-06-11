from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.interfaces.permissions import HasComponentAccess
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
    permission_classes = (HasComponentAccess,)
    required_component = "customers.management"
    filterset_class = CustomerFilter
    search_fields = ("document_number", "first_name", "last_name", "email", "phone")
    ordering_fields = ("created_at", "first_name", "last_name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve", "purchase_history"} else "edit"
        return super().get_permissions()

    @action(detail=True, methods=("get",), url_path="purchase-history")
    def purchase_history(self, request, pk=None):
        customer = self.get_object()
        orders = customer.orders.values("id", "number", "status", "total", "created_at")
        return Response(orders)


class CustomerContactViewSet(SoftDeleteModelViewSet):
    queryset = CustomerContact.objects.select_related("customer")
    serializer_class = CustomerContactSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "customers.management"
    filterset_fields = ("customer", "is_primary")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class CustomerSegmentViewSet(SoftDeleteModelViewSet):
    queryset = CustomerSegment.objects.all()
    serializer_class = CustomerSegmentSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "customers.management"
    search_fields = ("name",)

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()
