import django_filters
from django.db.models import Q

from ..infrastructure.models import PaymentAccount


class PaymentAccountFilter(django_filters.FilterSet):
    id_number = django_filters.NumberFilter(field_name="number", lookup_expr="exact")
    name = django_filters.CharFilter(method="filter_name")
    date_from = django_filters.DateFilter(field_name="issue_date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="issue_date", lookup_expr="lte")

    class Meta:
        model = PaymentAccount
        fields = ()

    def filter_name(self, queryset, name, value):
        value = (value or "").strip()
        if not value:
            return queryset
        return queryset.filter(
            Q(contractor_name__icontains=value) | Q(client_name__icontains=value)
        )
