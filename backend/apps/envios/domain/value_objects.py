from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from urllib.parse import urlparse

from .exceptions import EstadoEnvioInvalido, GuiaInvalida


class EstadoEnvio(StrEnum):
    PENDIENTE = "PENDIENTE"
    GENERANDO_GUIA = "GENERANDO_GUIA"
    GUIA_GENERADA = "GUIA_GENERADA"
    RECOGIDA_PROGRAMADA = "RECOGIDA_PROGRAMADA"
    RECOGIDO = "RECOGIDO"
    EN_TRANSITO = "EN_TRANSITO"
    EN_REPARTO = "EN_REPARTO"
    ENTREGADO = "ENTREGADO"
    NOVEDAD = "NOVEDAD"
    DEVUELTO = "DEVUELTO"
    CANCELADO = "CANCELADO"

    @classmethod
    def parse(cls, value):
        try:
            return cls(str(value).upper())
        except ValueError as exc:
            raise EstadoEnvioInvalido("El estado de envío no es válido.") from exc


@dataclass(frozen=True)
class NumeroGuia:
    value: str

    def __post_init__(self):
        normalized = self.value.strip()
        if not 3 <= len(normalized) <= 120:
            raise GuiaInvalida("El número de guía debe tener entre 3 y 120 caracteres.")
        object.__setattr__(self, "value", normalized)


@dataclass(frozen=True)
class CodigoTransportadora:
    value: str

    def __post_init__(self):
        normalized = self.value.strip().upper().replace(" ", "_")
        if not normalized or len(normalized) > 40:
            raise ValueError("El código de transportadora no es válido.")
        object.__setattr__(self, "value", normalized)


@dataclass(frozen=True)
class TrackingUrl:
    value: str

    def __post_init__(self):
        normalized = self.value.strip()
        parsed = urlparse(normalized)
        if normalized and (parsed.scheme not in {"http", "https"} or not parsed.netloc):
            raise ValueError("La URL de rastreo debe usar HTTP o HTTPS.")
        object.__setattr__(self, "value", normalized)


@dataclass(frozen=True)
class CostoEnvio:
    value: Decimal
    currency: str = "COP"

    def __post_init__(self):
        try:
            amount = Decimal(self.value)
        except (InvalidOperation, TypeError) as exc:
            raise ValueError("El costo de envío no es válido.") from exc
        if amount < 0:
            raise ValueError("El costo de envío no puede ser negativo.")
        object.__setattr__(self, "value", amount)
        object.__setattr__(self, "currency", self.currency.upper())
