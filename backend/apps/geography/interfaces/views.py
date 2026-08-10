import ipaddress
import logging
from urllib.parse import urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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


LOCATIONIQ_API_KEY = getattr(settings, "LOCATIONIQ_API_KEY", "")
LOCATIONIQ_BASE_URL = "https://us1.locationiq.com/v1"
NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"
NOMINATIM_CONTACT = getattr(settings, "NOMINATIM_CONTACT_EMAIL", "") or "no-reply@juhniosrold.com"
NOMINATIM_HEADERS = {
    "Accept-Language": "es",
    "User-Agent": f"JuhniosRoldApp/1.0 ({NOMINATIM_CONTACT})",
}
GEOCODING_CACHE_TTL_SECONDS = 60 * 60
GEOCODING_REQUEST_TIMEOUT_SECONDS = 4

# Caja delimitadora de Colombia continental + insular (lon_min, lat_max, lon_max, lat_min —
# formato viewbox de Nominatim/LocationIQ). Con bounded=1 esto recorta duro los resultados a
# territorio colombiano además del filtro countrycodes, mejorando precisión y velocidad al
# reducir el espacio de búsqueda que el proveedor tiene que rankear. lon_min se extiende hasta
# -82.0 (no -79.1) para no excluir San Andrés y Providencia (~-81.70), un departamento real con
# tarifa propia en calcular_costo_envio.py — un box más ajustado dejaría sus direcciones sin
# resultados de búsqueda.
COLOMBIA_VIEWBOX = "-82.0,13.5,-66.8,-4.3"

# Sesión HTTP reutilizada entre requests (keep-alive + pool de conexiones) en vez de abrir una
# conexión TCP/TLS nueva por cada búsqueda — es la mayor fuente de latencia evitable en un
# proxy de geocoding que se llama en cada tecleo del usuario. Un reintento corto absorbe fallos
# transitorios de red sin que el usuario tenga que volver a escribir.
_session = requests.Session()
_retry = Retry(total=1, backoff_factor=0.1, status_forcelist=(502, 503, 504), allowed_methods=("GET",))
_adapter = HTTPAdapter(max_retries=_retry, pool_connections=20, pool_maxsize=20)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)


def _geocoding_get(path: str, params: dict[str, str]) -> tuple[object, int]:
    cache_key = f"geocoding:{path}:{urlencode(sorted(params.items()))}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached, 200

    if LOCATIONIQ_API_KEY:
        base_url = LOCATIONIQ_BASE_URL
        request_params = {**params, "key": LOCATIONIQ_API_KEY, "accept-language": "es"}
        headers = {}
        provider = "LocationIQ"
    else:
        base_url = NOMINATIM_BASE_URL
        request_params = params
        headers = NOMINATIM_HEADERS
        provider = "Nominatim"

    url = f"{base_url}{path}"
    try:
        response = _session.get(url, params=request_params, headers=headers, timeout=GEOCODING_REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        payload = response.json()
        cache.set(cache_key, payload, GEOCODING_CACHE_TTL_SECONDS)
        return payload, response.status_code
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        logger.warning("%s respondio %s para %s", provider, status_code, url)
        if status_code == 429:
            return {"detail": "Demasiadas solicitudes al servicio de geocodificacion. Intenta de nuevo en un momento."}, 503
        return {"detail": "No fue posible consultar el servicio de geocodificacion."}, 502
    except requests.RequestException as exc:
        logger.warning("Error de red consultando %s: %s", provider, exc)
        return {"detail": "No fue posible consultar el servicio de geocodificacion."}, 502


def _bounded_limit(value: str, default: int = 5, maximum: int = 10) -> int:
    try:
        return min(max(int(value), 1), maximum)
    except (TypeError, ValueError):
        return default


class GeocodingSearchView(APIView):
    permission_classes = (AllowAny,)
    throttle_scope = "geocoding"

    def get(self, request):
        query = str(request.query_params.get("q", "")).strip()[:200]
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
            # Además del filtro por país, recortamos a la caja geográfica real cuando la
            # búsqueda está acotada a Colombia — reduce candidatos ambiguos (nombres de calle
            # repetidos en otras ciudades del mismo país) y acelera el ranking del proveedor.
            if country_codes.lower() == "co":
                params["viewbox"] = COLOMBIA_VIEWBOX
                params["bounded"] = "1"

        payload, upstream_status = _geocoding_get("/search", params)
        return Response(payload, status=upstream_status)


class GeocodingReverseView(APIView):
    permission_classes = (AllowAny,)
    throttle_scope = "geocoding"

    def get(self, request):
        lat = str(request.query_params.get("lat", "")).strip()
        lon = str(request.query_params.get("lon", "")).strip()
        if not lat or not lon:
            return Response(
                {"detail": "Debes enviar latitud y longitud."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload, upstream_status = _geocoding_get(
            "/reverse",
            {
                "format": "json",
                "addressdetails": "1",
                "lat": lat,
                "lon": lon,
            },
        )
        return Response(payload, status=upstream_status)


IP_LOCATION_CACHE_TTL_SECONDS = 60 * 60 * 6
IP_API_URL = "http://ip-api.com/json/{ip}"


def _client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR", "")


def _is_public_ip(ip: str) -> bool:
    """True solo para IPs enrutables públicamente. Usa el módulo estándar ipaddress en vez de
    prefijos de string sueltos — un chequeo como ip.startswith("172.16.") deja pasar el resto
    del rango privado 172.16.0.0/12 (172.17.x.x–172.31.x.x, el usado por defecto por las redes
    bridge de Docker), coincidiendo el contenedor backend en esta misma infraestructura."""
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (parsed.is_private or parsed.is_loopback or parsed.is_link_local or parsed.is_reserved)


class IpLocationView(APIView):
    """Ubicación aproximada por IP, solo para centrar el mapa antes de que el usuario
    interactúe (nunca para fijar el pin) — así el checkout arranca ya cerca de la ciudad real
    del usuario en vez del centro de Colombia, sin pedirle el permiso de geolocalización."""

    permission_classes = (AllowAny,)
    throttle_scope = "geocoding"

    def get(self, request):
        ip = _client_ip(request)
        if not ip or not _is_public_ip(ip):
            return Response({"lat": None, "lng": None}, status=status.HTTP_200_OK)

        cache_key = f"ip-location:{ip}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)

        try:
            response = _session.get(
                IP_API_URL.format(ip=ip),
                params={"fields": "status,lat,lon,city"},
                timeout=GEOCODING_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as exc:
            logger.warning("Error de red consultando ip-api.com: %s", exc)
            return Response({"lat": None, "lng": None}, status=status.HTTP_200_OK)

        if data.get("status") != "success":
            payload = {"lat": None, "lng": None}
        else:
            payload = {"lat": data.get("lat"), "lng": data.get("lon"), "city": data.get("city")}

        cache.set(cache_key, payload, IP_LOCATION_CACHE_TTL_SECONDS)
        return Response(payload, status=status.HTTP_200_OK)
