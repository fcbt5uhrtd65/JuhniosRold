import django_filters

from ..infrastructure.models import Customer


class CustomerFilter(django_filters.FilterSet):
    segment = django_filters.UUIDFilter(field_name="segments__id")
    city = django_filters.CharFilter(field_name="city", lookup_expr="icontains")
    min_orders = django_filters.NumberFilter(field_name="orders_count", lookup_expr="gte")
    max_orders = django_filters.NumberFilter(field_name="orders_count", lookup_expr="lte")

    class Meta:
        model = Customer
        fields = ("is_active", "city", "segment")
