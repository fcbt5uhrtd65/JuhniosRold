from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CityViewSet,
    CountryViewSet,
    GeocodingReverseView,
    GeocodingSearchView,
    StateViewSet,
)

router = DefaultRouter()
router.register("countries", CountryViewSet, basename="country")
router.register("states", StateViewSet, basename="state")
router.register("cities", CityViewSet, basename="city")

urlpatterns = [
    *router.urls,
    path("geocoding/search/", GeocodingSearchView.as_view(), name="geocoding-search"),
    path("geocoding/reverse/", GeocodingReverseView.as_view(), name="geocoding-reverse"),
]
