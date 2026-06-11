from django.utils.dateparse import parse_datetime

from ...infrastructure.repositories import DjangoEnvioRepository
from ...infrastructure.shipping_gateways import get_shipping_gateway
from ..dtos import ActualizarEstadoEnvioDTO
from .actualizar_estado_envio import ActualizarEstadoEnvioUseCase


class ActualizarTrackingUseCase:
    def __init__(self, repository=None, gateway=None):
        self.repository = repository or DjangoEnvioRepository()
        self.gateway = gateway

    def execute(self, *, envio_id, actor=None):
        envio = self.repository.get(envio_id)
        if not envio.numero_guia:
            return envio
        gateway = self.gateway or get_shipping_gateway(envio.proveedor_externo)
        response = gateway.get_tracking(tracking_number=envio.numero_guia)
        updater = ActualizarEstadoEnvioUseCase(self.repository)
        events = response.get("events") or [
            {
                "id": response.get("event_id", ""),
                "status": response.get("status", envio.estado_envio),
                "description": response.get("description", ""),
                "location": response.get("location", ""),
                "occurred_at": response.get("occurred_at"),
            }
        ]
        for event in events:
            event_date = event.get("occurred_at")
            if isinstance(event_date, str):
                event_date = parse_datetime(event_date)
            envio = updater.execute(
                envio_id=envio.id,
                dto=ActualizarEstadoEnvioDTO(
                    estado=event.get("status", envio.estado_envio),
                    descripcion=event.get("description", ""),
                    ubicacion=event.get("location", ""),
                    fecha_evento=event_date,
                    external_event_id=str(event.get("id", "")),
                    raw_payload=event,
                ),
                actor=actor,
            )
        return envio
