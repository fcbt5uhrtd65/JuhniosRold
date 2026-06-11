from django.db import transaction

from shared.domain.exceptions import BusinessRuleViolation

from apps.audit.application.services import AuditService
from apps.commerce.infrastructure.models import Order

from ...infrastructure.models import EnvioModel
from ...infrastructure.repositories import DjangoEnvioRepository


class CrearEnvioUseCase:
    ALLOWED_ORDER_STATUSES = {
        Order.Status.PAID,
        Order.Status.CONFIRMED,
        Order.Status.PROCESSING,
        Order.Status.PACKED,
        Order.Status.SHIPPED,
        Order.Status.IN_TRANSIT,
    }

    def __init__(self, repository=None):
        self.repository = repository or DjangoEnvioRepository()

    @transaction.atomic
    def execute(self, dto, actor=None):
        order = (
            Order.objects.select_for_update()
            .select_related("customer")
            .get(pk=dto.pedido_id)
        )
        if order.status not in self.ALLOWED_ORDER_STATUSES:
            raise BusinessRuleViolation(
                "Solo se puede crear un envío para un pedido pagado o en preparación."
            )
        if EnvioModel.objects.filter(pedido=order).exists():
            raise BusinessRuleViolation("El pedido ya tiene un envío asociado.")

        envio = self.repository.create(
            pedido=order,
            direccion_envio=dto.direccion_envio or order.shipping_address,
            ciudad=dto.ciudad or order.customer.city,
            departamento=dto.departamento,
            pais=dto.pais,
            codigo_postal=dto.codigo_postal,
            costo_envio=dto.costo_envio,
            fecha_entrega_estimada=dto.fecha_entrega_estimada,
            created_by=actor if getattr(actor, "is_authenticated", False) else None,
            updated_by=actor if getattr(actor, "is_authenticated", False) else None,
        )
        envio.eventos.create(
            estado=envio.estado_envio,
            descripcion="Envío creado y pendiente de guía.",
            fecha_evento=envio.created_at,
            changed_by=actor if getattr(actor, "is_authenticated", False) else None,
        )
        AuditService.record(
            actor=actor,
            module="envios",
            action="SHIPMENT_CREATED",
            resource_type="Envio",
            resource_id=envio.id,
            metadata={"pedido_id": str(order.id)},
        )
        return self.repository.get(envio.id)
