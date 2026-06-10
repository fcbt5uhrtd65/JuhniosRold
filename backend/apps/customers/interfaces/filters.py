import django_filters

from ..infrastructure.models import Customer


class CustomerFilter(django_filters.FilterSet):
    segment = django_filters.UUIDFilter(field_name="segments__id")

    class Meta:
        model = Customer
        fields = ("is_active", "city", "segment")
