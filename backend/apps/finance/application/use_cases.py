from django.db.models import Q, Sum

from ..infrastructure.models import FinancialTransaction


class GetIncomeVsExpenses:
    def execute(self, start_date=None, end_date=None):
        queryset = FinancialTransaction.objects.all()
        if start_date:
            queryset = queryset.filter(occurred_on__gte=start_date)
        if end_date:
            queryset = queryset.filter(occurred_on__lte=end_date)
        totals = queryset.aggregate(
            income=Sum("amount", filter=Q(transaction_type=FinancialTransaction.Type.INCOME)),
            expenses=Sum("amount", filter=Q(transaction_type=FinancialTransaction.Type.EXPENSE)),
        )
        return {key: value or 0 for key, value in totals.items()}
