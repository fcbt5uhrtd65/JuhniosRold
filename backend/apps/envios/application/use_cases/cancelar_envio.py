from django.db import transaction

from ...infrastructure.repositories import DjangoEnvioRepository
from ...infrastructure.shipping_gateways import get_shipping_gateway
from ..services import EnvioStateService


class CancelarEnvioUseCase:
    def __init__(self, repository=None, gateway=None):
        self.repository = repository or DjangoEnvioRepository()
        self.gateway = gateway

    @transaction.atomic
    def execute(self, *, envio_id, actor=None):
        envio = self.repository.get(envio_id)
        raw_payload = {}
        if envio.external_shipment_id and envio.proveedor_externo != "manual":
            gateway = self.gateway or get_shipping_gateway(envio.proveedor_externo)
            raw_payload = gateway.cancel_shipment(
                external_shipment_id=envio.external_shipment_id
            )
        envio, _, _ = EnvioStateService.change(
            envio=envio,
            estado=envio.Estado.CANCELADO,
            actor=actor,
            descripcion="Envío cancelado.",
            raw_payload=raw_payload,
        )
        return self.repository.get(envio.id)
