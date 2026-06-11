from django.db import transaction
from django.utils import timezone

from apps.audit.application.services import AuditService
from apps.commerce.application.services import OrderStatusService
from apps.commerce.infrastructure.models import Order

from ..domain.exceptions import EstadoEnvioInvalido
from ..domain.value_objects import EstadoEnvio
from ..infrastructure.models import EnvioModel, TrackingEventModel


class EnvioStateService:
    TERMINAL_STATES = {
        EnvioModel.Estado.ENTREGADO,
        EnvioModel.Estado.DEVUELTO,
        EnvioModel.Estado.CANCELADO,
    }

    ORDER_STATUS_MAP = {
        EnvioModel.Estado.GUIA_GENERADA: Order.Status.SHIPPED,
        EnvioModel.Estado.RECOGIDA_PROGRAMADA: Order.Status.SHIPPED,
        EnvioModel.Estado.RECOGIDO: Order.Status.SHIPPED,
        EnvioModel.Estado.EN_TRANSITO: Order.Status.IN_TRANSIT,
        EnvioModel.Estado.EN_REPARTO: Order.Status.IN_TRANSIT,
        EnvioModel.Estado.ENTREGADO: Order.Status.DELIVERED,
        EnvioModel.Estado.DEVUELTO: Order.Status.RETURNED,
    }

    @classmethod
    @transaction.atomic
    def change(
        cls,
        *,
        envio,
        estado,
        actor=None,
        descripcion="",
        ubicacion="",
        fecha_evento=None,
        external_event_id="",
        raw_payload=None,
        allow_same_status_event=False,
    ):
        estado = EstadoEnvio.parse(estado).value
        envio = (
            EnvioModel.objects.select_for_update()
            .select_related("pedido")
            .get(pk=envio.pk)
        )

        if external_event_id:
            duplicate = TrackingEventModel.objects.filter(
                external_event_id=external_event_id
            ).first()
            if duplicate:
                return envio, duplicate, False

        if envio.estado_envio in cls.TERMINAL_STATES and envio.estado_envio != estado:
            raise EstadoEnvioInvalido(
                "No se puede cambiar un envío que ya está en un estado terminal."
            )

        changed = envio.estado_envio != estado
        previous_status = envio.estado_envio
        now = fecha_evento or timezone.now()
        if changed:
            envio.estado_envio = estado
            envio.updated_by = actor if getattr(actor, "is_authenticated", False) else None
            fields = ["estado_envio", "updated_by", "updated_at"]
            if estado in {
                EnvioModel.Estado.GUIA_GENERADA,
                EnvioModel.Estado.RECOGIDA_PROGRAMADA,
                EnvioModel.Estado.RECOGIDO,
                EnvioModel.Estado.EN_TRANSITO,
            } and not envio.fecha_despacho:
                envio.fecha_despacho = now
                fields.append("fecha_despacho")
            if estado == EnvioModel.Estado.ENTREGADO:
                envio.fecha_entrega_real = now
                fields.append("fecha_entrega_real")
            envio.save(update_fields=fields)

        event = None
        if changed or allow_same_status_event:
            event = TrackingEventModel.objects.create(
                envio=envio,
                estado=estado,
                descripcion=descripcion,
                ubicacion=ubicacion,
                fecha_evento=now,
                raw_payload=raw_payload or {},
                external_event_id=external_event_id or None,
                changed_by=actor if getattr(actor, "is_authenticated", False) else None,
            )

        order_status = cls.ORDER_STATUS_MAP.get(estado)
        if changed and order_status:
            OrderStatusService.change(
                order=envio.pedido,
                status=order_status,
                actor=actor,
                notes=f"Sincronizado desde envíos: {descripcion or estado}.",
                source="envios",
            )

        if changed:
            AuditService.record(
                actor=actor,
                module="envios",
                action="SHIPMENT_STATUS_CHANGED",
                resource_type="Envio",
                resource_id=envio.id,
                metadata={
                    "pedido_id": str(envio.pedido_id),
                    "previous_status": previous_status,
                    "new_status": estado,
                },
            )
            envio_id = str(envio.id)
            transaction.on_commit(
                lambda: cls._enqueue_status_notifications(envio_id)
            )
        return envio, event, changed

    @staticmethod
    def _enqueue_status_notifications(envio_id):
        from ..infrastructure.tasks import enqueue_shipping_notifications

        enqueue_shipping_notifications(envio_id)
