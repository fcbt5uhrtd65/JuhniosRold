from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class CrearEnvioDTO:
    pedido_id: UUID
    direccion_envio: str = ""
    ciudad: str = ""
    departamento: str = ""
    pais: str = "CO"
    codigo_postal: str = ""
    costo_envio: Decimal = Decimal("0")
    fecha_entrega_estimada: datetime | None = None


@dataclass(frozen=True)
class RegistrarGuiaManualDTO:
    transportadora_id: UUID
    numero_guia: str
    tracking_url: str = ""
    costo_envio: Decimal | None = None
    fecha_entrega_estimada: datetime | None = None


@dataclass(frozen=True)
class ActualizarEstadoEnvioDTO:
    estado: str
    descripcion: str = ""
    ubicacion: str = ""
    fecha_evento: datetime | None = None
    external_event_id: str = ""
    raw_payload: dict | None = None
