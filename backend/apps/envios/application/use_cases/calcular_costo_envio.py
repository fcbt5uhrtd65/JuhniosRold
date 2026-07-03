import logging
import math
import unicodedata
from dataclasses import dataclass
from decimal import Decimal

from ...infrastructure.models import ShippingCalculation, ShippingSettings, ShippingZone

logger = logging.getLogger(__name__)

METROPOLITAN_CITIES = {
    "BARRANQUILLA",
    "SOLEDAD",
    "MALAMBO",
    "GALAPA",
    "PUERTO COLOMBIA",
    "TUBARA",
    "TUBARÁ",
    "SABANALARGA",
    "BARANOA",
}

# Coordenadas aproximadas (lat, lng) de la capital de cada departamento de Colombia.
# Se usan como aproximación de la ubicación del destinatario cuando el checkout no
# cuenta con lat/lng exactas del cliente, permitiendo calcular la distancia real por
# haversine desde la bodega (Barranquilla) en vez de aplicar una tarifa plana nacional.
DEPARTMENT_CAPITAL_COORDS: dict[str, tuple[float, float]] = {
    "AMAZONAS": (-4.203889, -69.940833),          # Leticia
    "ANTIOQUIA": (6.244203, -75.581215),           # Medellín
    "ARAUCA": (7.0902, -70.7617),                  # Arauca
    "ATLANTICO": (10.968854, -74.781319),          # Barranquilla
    "ATLÁNTICO": (10.968854, -74.781319),
    "BOLIVAR": (10.391049, -75.479426),            # Cartagena
    "BOLÍVAR": (10.391049, -75.479426),
    "BOYACA": (5.537778, -73.367222),              # Tunja
    "BOYACÁ": (5.537778, -73.367222),
    "CALDAS": (5.069611, -75.517778),              # Manizales
    "CAQUETA": (1.615000, -75.606389),             # Florencia
    "CAQUETÁ": (1.615000, -75.606389),
    "CASANARE": (5.339722, -72.395833),            # Yopal
    "CAUCA": (2.444814, -76.614739),                # Popayán
    "CESAR": (10.463333, -73.251667),              # Valledupar
    "CHOCO": (5.694444, -76.658333),                # Quibdó
    "CHOCÓ": (5.694444, -76.658333),
    "CORDOBA": (8.750000, -75.883333),              # Montería
    "CÓRDOBA": (8.750000, -75.883333),
    "CUNDINAMARCA": (4.710989, -74.072092),         # Bogotá (referencia)
    "BOGOTA": (4.710989, -74.072092),
    "BOGOTÁ": (4.710989, -74.072092),
    "BOGOTA D.C.": (4.710989, -74.072092),
    "BOGOTÁ D.C.": (4.710989, -74.072092),
    "GUAINIA": (3.891111, -67.900000),              # Inírida
    "GUAINÍA": (3.891111, -67.900000),
    "GUAVIARE": (2.041389, -72.633333),             # San José del Guaviare
    "HUILA": (2.927778, -75.281389),                # Neiva
    "LA GUAJIRA": (11.544722, -72.907222),          # Riohacha
    "GUAJIRA": (11.544722, -72.907222),
    "MAGDALENA": (11.240278, -74.199167),           # Santa Marta
    "META": (4.142222, -73.626389),                 # Villavicencio
    "NARINO": (1.213889, -77.281111),               # Pasto
    "NARIÑO": (1.213889, -77.281111),
    "NORTE DE SANTANDER": (7.893611, -72.507778),   # Cúcuta
    "PUTUMAYO": (1.148611, -76.648611),             # Mocoa
    "QUINDIO": (4.538889, -75.681389),               # Armenia
    "QUINDÍO": (4.538889, -75.681389),
    "RISARALDA": (4.813333, -75.696111),            # Pereira
    "SAN ANDRES Y PROVIDENCIA": (12.583333, -81.700000),  # San Andrés
    "SAN ANDRÉS Y PROVIDENCIA": (12.583333, -81.700000),
    "SANTANDER": (7.119349, -73.122741),            # Bucaramanga
    "SUCRE": (9.303889, -75.397778),                 # Sincelejo
    "TOLIMA": (4.438611, -75.232222),                # Ibagué
    "VALLE DEL CAUCA": (3.451647, -76.531985),      # Cali
    "VAUPES": (1.253333, -70.235833),                # Mitú
    "VAUPÉS": (1.253333, -70.235833),
    "VICHADA": (6.190000, -67.481667),               # Puerto Carreño
}


@dataclass
class ShippingQuoteInput:
    city: str = ""
    department: str = ""
    latitude: Decimal | float | None = None
    longitude: Decimal | float | None = None
    subtotal: Decimal = Decimal("0")


@dataclass
class ShippingQuoteResult:
    status: str
    method: str
    shipping_cost: Decimal
    distance_km: Decimal | None
    zone: ShippingZone | None
    message: str


def _normalize(value: str) -> str:
    return (value or "").strip().upper()


def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    lat1, lng1, lat2, lng2 = map(math.radians, (float(lat1), float(lng1), float(lat2), float(lng2)))
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


class CalculateShippingCost:
    """Calcula el costo de envío para una dirección de destino.

    No confía en ningún valor enviado por el cliente: toma la config vigente
    (ShippingSettings) y las zonas especiales (ShippingZone) desde la base de
    datos y recalcula siempre server-side.
    """

    def execute(self, quote_input: ShippingQuoteInput, settings_obj: ShippingSettings | None = None) -> ShippingQuoteResult:
        settings_obj = settings_obj or ShippingSettings.current()
        city = _normalize(quote_input.city)
        department = _normalize(quote_input.department)

        if not city and not department:
            return ShippingQuoteResult(
                status=ShippingCalculation.Status.NO_COVERAGE,
                method=ShippingCalculation.Method.MANUAL,
                shipping_cost=Decimal("0"),
                distance_km=None,
                zone=None,
                message="Ingresa tu dirección para calcular el envío.",
            )

        zone = self._match_zone(city, department)

        if zone and zone.requires_manual_quote:
            qualifies_for_free_shipping = (
                settings_obj.enable_free_shipping
                and quote_input.subtotal
                and quote_input.subtotal >= settings_obj.free_shipping_threshold
            )
            message = "Tu zona requiere cotización manual. Nuestro equipo se pondrá en contacto contigo."
            if qualifies_for_free_shipping:
                message += " Tu pedido ya califica para envío gratis; solo confirmaremos la logística de entrega."
            return ShippingQuoteResult(
                status=ShippingCalculation.Status.PENDING_MANUAL,
                method=ShippingCalculation.Method.MANUAL,
                shipping_cost=Decimal("0"),
                distance_km=None,
                zone=zone,
                message=message,
            )

        try:
            base_cost, method, distance_km = self._base_cost(quote_input, settings_obj, city, department, zone)
        except _NoCoverageError:
            if settings_obj.enable_manual_quote_fallback:
                return ShippingQuoteResult(
                    status=ShippingCalculation.Status.PENDING_MANUAL,
                    method=ShippingCalculation.Method.MANUAL,
                    shipping_cost=Decimal("0"),
                    distance_km=None,
                    zone=zone,
                    message="No pudimos calcular tu envío automáticamente. Quedará pendiente de confirmación manual.",
                )
            return ShippingQuoteResult(
                status=ShippingCalculation.Status.NO_COVERAGE,
                method=ShippingCalculation.Method.MANUAL,
                shipping_cost=Decimal("0"),
                distance_km=None,
                zone=zone,
                message="Tu zona aún no tiene cobertura de envío.",
            )

        surcharge = zone.surcharge if zone else Decimal("0")
        cost = base_cost + surcharge

        if (
            settings_obj.enable_free_shipping
            and quote_input.subtotal
            and quote_input.subtotal >= settings_obj.free_shipping_threshold
        ):
            return ShippingQuoteResult(
                status=ShippingCalculation.Status.FREE,
                method=ShippingCalculation.Method.FREE,
                shipping_cost=Decimal("0"),
                distance_km=distance_km,
                zone=zone,
                message="Tu pedido aplica para envío gratis.",
            )

        return ShippingQuoteResult(
            status=ShippingCalculation.Status.CALCULATED,
            method=method,
            shipping_cost=cost,
            distance_km=distance_km,
            zone=zone,
            message="Costo de envío calculado según tu dirección.",
        )

    def _match_zone(self, city: str, department: str) -> ShippingZone | None:
        zones = ShippingZone.objects.filter(is_active=True, deleted_at__isnull=True)
        if city:
            match = zones.filter(city__iexact=city).first()
            if match:
                return match
        if department:
            match = zones.filter(department__iexact=department, city="").first()
            if match:
                return match
        return None

    def _base_cost(self, quote_input, settings_obj, city, department, zone):
        has_origin = settings_obj.origin_latitude is not None and settings_obj.origin_longitude is not None

        if settings_obj.enable_distance_calc and has_origin:
            dest_lat, dest_lng, is_exact = self._resolve_destination_coords(
                quote_input.latitude, quote_input.longitude, city, department,
            )
            if dest_lat is not None and dest_lng is not None:
                distance_km = Decimal(str(round(_haversine_km(
                    settings_obj.origin_latitude, settings_obj.origin_longitude,
                    dest_lat, dest_lng,
                ), 2)))
                cost = settings_obj.base_rate + (distance_km * settings_obj.rate_per_km)
                cost = max(settings_obj.min_charge, min(cost, settings_obj.max_charge))
                method = ShippingCalculation.Method.DISTANCE if is_exact else ShippingCalculation.Method.ZONE
                return cost, method, distance_km

        # Sin coordenadas exactas ni capital departamental reconocida: última
        # instancia, tarifa plana por tipo de zona geográfica (metropolitana,
        # departamental o nacional). El zone_type de una ShippingZone nunca
        # determina la tarifa base — solo aporta recargo/cotización manual —
        # para que una mala configuración en el admin no "abarate" una ciudad
        # nacional a tarifa regional/local.
        zone_type = self._infer_zone_type(city, department)
        if zone_type == ShippingZone.ZoneType.LOCAL:
            return settings_obj.local_rate, ShippingCalculation.Method.ZONE, None
        if zone_type == ShippingZone.ZoneType.REGIONAL:
            return settings_obj.regional_rate, ShippingCalculation.Method.ZONE, None
        if zone_type == ShippingZone.ZoneType.NATIONAL:
            return settings_obj.national_rate, ShippingCalculation.Method.ZONE, None
        raise _NoCoverageError()

    def _resolve_destination_coords(self, latitude, longitude, city, department):
        """Devuelve (lat, lng, es_exacta) del destino.

        Prioriza las coordenadas exactas del cliente; si no existen, aproxima
        con la capital del departamento para poder calcular distancia real en
        todo el país en vez de caer directo a tarifa plana nacional.
        """
        if latitude is not None and longitude is not None:
            return latitude, longitude, True

        coords = DEPARTMENT_CAPITAL_COORDS.get(department) or DEPARTMENT_CAPITAL_COORDS.get(_strip_accents(department))
        if coords:
            return coords[0], coords[1], False

        return None, None, False

    def _infer_zone_type(self, city: str, department: str) -> str:
        if city in METROPOLITAN_CITIES:
            return ShippingZone.ZoneType.LOCAL
        if department == "ATLANTICO" or department == "ATLÁNTICO":
            return ShippingZone.ZoneType.REGIONAL
        if department or city:
            return ShippingZone.ZoneType.NATIONAL
        return ""


class _NoCoverageError(Exception):
    pass
