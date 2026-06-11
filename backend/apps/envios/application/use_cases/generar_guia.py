from django.conf import settings
from django.db import transaction

from ...infrastructure.repositories import DjangoEnvioRepository
from ...infrastructure.shipping_gateways import get_shipping_gateway
from ..services import EnvioStateService


class GenerarGuiaUseCase:
    def __init__(self, repository=None, gateway=None):
        self.repository = repository or DjangoEnvioRepository()
        self.gateway = gateway

    @transaction.atomic
    def execute(self, *, envio_id, actor=None, provider=None):
        envio = self.repository.get(envio_id)
        gateway = self.gateway or get_shipping_gateway(provider)
        EnvioStateService.change(
            envio=envio,
            estado=envio.Estado.GENERANDO_GUIA,
            actor=actor,
            descripcion="Solicitud de generación de guía enviada.",
        )
        response = gateway.create_shipment(
            shipment_data={
                "shipment_id": str(envio.id),
                "order_id": str(envio.pedido_id),
                "order_number": envio.pedido.number,
                "address": envio.direccion_envio,
                "city": envio.ciudad,
                "department": envio.departamento,
                "country": envio.pais,
                "postal_code": envio.codigo_postal,
                "declared_value": str(envio.pedido.total),
            }
        )
        envio.external_shipment_id = response.get("external_shipment_id", "")
        envio.numero_guia = response.get("tracking_number", "")
        envio.tracking_url = response.get("tracking_url", "")
        envio.external_label_url = response.get("label_url", "")
        envio.proveedor_externo = provider or settings.SHIPPING_PROVIDER
        envio.raw_response = response.get("raw_response", response)
        envio.updated_by = actor if getattr(actor, "is_authenticated", False) else None
        envio.save(
            update_fields=(
                "external_shipment_id",
                "numero_guia",
                "tracking_url",
                "external_label_url",
                "proveedor_externo",
                "raw_response",
                "updated_by",
                "updated_at",
            )
        )
        EnvioStateService.change(
            envio=envio,
            estado=response.get("status", envio.Estado.GUIA_GENERADA),
            actor=actor,
            descripcion="Guía generada por el proveedor logístico.",
            raw_payload=response,
        )
        return self.repository.get(envio.id)
