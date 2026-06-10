from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import FinancialTransaction
from ..infrastructure.serializers import FinancialTransactionSerializer


class FinancialTransactionViewSet(SoftDeleteModelViewSet):
    queryset = FinancialTransaction.objects.select_related("created_by")
    serializer_class = FinancialTransactionSerializer
    filterset_fields = ("transaction_type", "category", "occurred_on")
    search_fields = ("category", "description", "reference")
    ordering_fields = ("occurred_on", "amount", "created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
