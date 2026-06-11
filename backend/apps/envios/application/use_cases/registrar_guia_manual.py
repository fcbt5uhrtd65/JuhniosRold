from django.db import transaction

from apps.audit.application.services import AuditService

from ...domain.value_objects import NumeroGuia, TrackingUrl
from ...infrastructure.models import TransportadoraModel
from ...infrastructure.repositories import DjangoEnvioRepository
from ..services import EnvioStateService


class RegistrarGuiaManualUseCase:
    def __init__(self, repository=None):
        self.repository = repository or DjangoEnvioRepository()

    @transaction.atomic
    def execute(self, *, envio_id, dto, actor=None):
        envio = self.repository.get(envio_id)
        carrier = TransportadoraModel.objects.get(
            pk=dto.transportadora_id,
            activa=True,
        )
        tracking_number = NumeroGuia(dto.numero_guia).value
        tracking_url = TrackingUrl(dto.tracking_url).value
        if not tracking_url and carrier.tracking_url_template:
            tracking_url = carrier.tracking_url_template.replace(
                "{numero_guia}",
                tracking_number,
            )

        envio.transportadora = carrier
        envio.numero_guia = tracking_number
        envio.tracking_url = tracking_url
        envio.proveedor_externo = "manual"
        envio.updated_by = actor if getattr(actor, "is_authenticated", False) else None
        fields = [
            "transportadora",
            "numero_guia",
            "tracking_url",
            "proveedor_externo",
            "updated_by",
            "updated_at",
        ]
        if dto.costo_envio is not None:
            envio.costo_envio = dto.costo_envio
            fields.append("costo_envio")
        if dto.fecha_entrega_estimada is not None:
            envio.fecha_entrega_estimada = dto.fecha_entrega_estimada
            fields.append("fecha_entrega_estimada")
        envio.save(update_fields=fields)

        envio, _, _ = EnvioStateService.change(
            envio=envio,
            estado=envio.Estado.GUIA_GENERADA,
            actor=actor,
            descripcion=f"Guía {tracking_number} registrada manualmente.",
        )
        AuditService.record(
            actor=actor,
            module="envios",
            action="MANUAL_LABEL_REGISTERED",
            resource_type="Envio",
            resource_id=envio.id,
            metadata={
                "carrier": carrier.codigo,
                "tracking_number": tracking_number,
            },
        )
        return self.repository.get(envio.id)
