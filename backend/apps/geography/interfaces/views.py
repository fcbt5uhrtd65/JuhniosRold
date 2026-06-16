from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from ..infrastructure.models import City, Country, State
from ..infrastructure.serializers import CitySerializer, CountrySerializer, StateSerializer


class CountryViewSet(ReadOnlyModelViewSet):
    serializer_class = CountrySerializer
    permission_classes = (AllowAny,)
    queryset = Country.objects.filter(is_active=True)
    search_fields = ("name", "iso_code")
    filterset_fields = ("is_active",)


class StateViewSet(ReadOnlyModelViewSet):
    serializer_class = StateSerializer
    permission_classes = (AllowAny,)
    queryset = State.objects.filter(is_active=True).select_related("country")
    search_fields = ("name", "code")
    filterset_fields = ("country", "is_active")


class CityViewSet(ReadOnlyModelViewSet):
    serializer_class = CitySerializer
    permission_classes = (AllowAny,)
    queryset = City.objects.filter(is_active=True).select_related("state", "country")
    search_fields = ("name",)
    filterset_fields = ("state", "country", "is_active")
