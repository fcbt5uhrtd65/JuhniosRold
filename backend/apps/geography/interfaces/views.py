import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from ..infrastructure.models import City, Country, State
from ..infrastructure.serializers import CitySerializer, CountrySerializer, StateSerializer

logger = logging.getLogger(__name__)


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


NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"
NOMINATIM_CONTACT = getattr(settings, "NOMINATIM_CONTACT_EMAIL", "") or "no-reply@juhniosrold.com"
NOMINATIM_HEADERS = {
    "Accept-Language": "es",
    "User-Agent": f"JuhniosRoldApp/1.0 ({NOMINATIM_CONTACT})",
}
NOMINATIM_CACHE_TTL_SECONDS = 60 * 60


def _nominatim_get(path: str, params: dict[str, str]) -> tuple[object, int]:
    cache_key = f"nominatim:{path}:{urlencode(sorted(params.items()))}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached, 200

    url = f"{NOMINATIM_BASE_URL}{path}?{urlencode(params)}"
    request = Request(url, headers=NOMINATIM_HEADERS)
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
            cache.set(cache_key, payload, NOMINATIM_CACHE_TTL_SECONDS)
            return payload, response.status
    except HTTPError as exc:
        logger.warning("Nominatim respondio %s para %s", exc.code, url)
        if exc.code == 429:
            return {"detail": "Demasiadas solicitudes al servicio de geocodificacion. Intenta de nuevo en un momento."}, 503
        return {"detail": "No fue posible consultar el servicio de geocodificacion."}, 502
    except (URLError, TimeoutError) as exc:
        logger.warning("Error de red consultando Nominatim: %s", exc)
        return {"detail": "No fue posible consultar el servicio de geocodificacion."}, 502


def _bounded_limit(value: str, default: int = 5, maximum: int = 10) -> int:
    try:
        return min(max(int(value), 1), maximum)
    except (TypeError, ValueError):
        return default


class GeocodingSearchView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        query = str(request.query_params.get("q", "")).strip()
        if not query:
            return Response([], status=status.HTTP_200_OK)

        contextual_query = ", ".join(
            part
            for part in (
                query,
                request.query_params.get("state", ""),
                request.query_params.get("country", ""),
            )
            if str(part).strip()
        )
        params = {
            "format": "json",
            "addressdetails": "1",
            "limit": str(_bounded_limit(request.query_params.get("limit", 5))),
            "q": contextual_query,
        }
        country_codes = str(request.query_params.get("countrycodes", "")).strip()
        if country_codes:
            params["countrycodes"] = country_codes

        payload, upstream_status = _nominatim_get("/search", params)
        return Response(payload, status=upstream_status)


class GeocodingReverseView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        lat = str(request.query_params.get("lat", "")).strip()
        lon = str(request.query_params.get("lon", "")).strip()
        if not lat or not lon:
            return Response(
                {"detail": "Debes enviar latitud y longitud."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload, upstream_status = _nominatim_get(
            "/reverse",
            {
                "format": "json",
                "addressdetails": "1",
                "lat": lat,
                "lon": lon,
            },
        )
        return Response(payload, status=upstream_status)
