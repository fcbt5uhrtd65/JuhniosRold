from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from .value_objects import EstadoEnvio


@dataclass(frozen=True)
class DireccionEnvio:
    direccion: str
    ciudad: str = ""
    departamento: str = ""
    pais: str = "CO"
    codigo_postal: str = ""


@dataclass(frozen=True)
class Transportadora:
    id: UUID
    codigo: str
    nombre: str
    activa: bool = True
    proveedor_externo: str = "manual"


@dataclass(frozen=True)
class Guia:
    numero: str
    tracking_url: str = ""
    label_url: str = ""
    generated_at: datetime | None = None


@dataclass(frozen=True)
class TrackingEvent:
    estado: EstadoEnvio
    descripcion: str
    fecha_evento: datetime
    ubicacion: str = ""
    raw_payload: dict[str, Any] = field(default_factory=dict)
    external_event_id: str = ""


@dataclass
class Envio:
    id: UUID
    pedido_id: UUID
    estado: EstadoEnvio
    direccion: DireccionEnvio
    transportadora: Transportadora | None = None
    guia: Guia | None = None
    costo: Decimal = Decimal("0")
    fecha_entrega_estimada: datetime | None = None
    fecha_entrega_real: datetime | None = None
    external_shipment_id: str = ""
    eventos: list[TrackingEvent] = field(default_factory=list)
