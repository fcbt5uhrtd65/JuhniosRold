import logging
import math
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
        has_coords = (
            settings_obj.enable_distance_calc
            and quote_input.latitude is not None
            and quote_input.longitude is not None
            and settings_obj.origin_latitude is not None
            and settings_obj.origin_longitude is not None
        )
        if has_coords:
            distance_km = Decimal(str(round(_haversine_km(
                settings_obj.origin_latitude, settings_obj.origin_longitude,
                quote_input.latitude, quote_input.longitude,
            ), 2)))
            cost = settings_obj.base_rate + (distance_km * settings_obj.rate_per_km)
            cost = max(settings_obj.min_charge, min(cost, settings_obj.max_charge))
            return cost, ShippingCalculation.Method.DISTANCE, distance_km

        # El zone_type SIEMPRE se infiere de la geografía real (ciudad/departamento),
        # nunca del campo editable de la ShippingZone: una zona especial solo aporta
        # recargo/cotización manual, no debe poder "abaratar" una ciudad nacional
        # a tarifa regional/local por una mala configuración en el admin.
        zone_type = self._infer_zone_type(city, department)
        if zone_type == ShippingZone.ZoneType.LOCAL:
            return settings_obj.local_rate, ShippingCalculation.Method.ZONE, None
        if zone_type == ShippingZone.ZoneType.REGIONAL:
            return settings_obj.regional_rate, ShippingCalculation.Method.ZONE, None
        if zone_type == ShippingZone.ZoneType.NATIONAL:
            return settings_obj.national_rate, ShippingCalculation.Method.ZONE, None
        raise _NoCoverageError()

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
