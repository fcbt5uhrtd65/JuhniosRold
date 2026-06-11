from rest_framework import viewsets

from apps.identity.interfaces.permissions import IsAdministrator
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import FinancialTransaction, SalesInvoice
from ..infrastructure.serializers import (
    FinancialTransactionSerializer,
    SalesInvoiceSerializer,
)


class FinancialTransactionViewSet(SoftDeleteModelViewSet):
    queryset = FinancialTransaction.objects.select_related("created_by")
    serializer_class = FinancialTransactionSerializer
    permission_classes = (IsAdministrator,)
    filterset_fields = ("transaction_type", "category", "occurred_on")
    search_fields = ("category", "description", "reference")
    ordering_fields = ("occurred_on", "amount", "created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SalesInvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SalesInvoice.objects.select_related(
        "order__customer",
        "payment",
    ).prefetch_related("lines")
    serializer_class = SalesInvoiceSerializer
    search_fields = ("number", "order__number", "customer_document", "customer_email")
    ordering_fields = ("issued_at", "total")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(order__customer__user=self.request.user)
