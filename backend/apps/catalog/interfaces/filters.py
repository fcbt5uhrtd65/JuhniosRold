import django_filters

from ..infrastructure.models import Product


class ProductFilter(django_filters.FilterSet):
    class Meta:
        model = Product
        fields = ("category", "is_active", "is_featured")
