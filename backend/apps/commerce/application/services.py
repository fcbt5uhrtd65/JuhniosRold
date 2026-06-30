import logging

from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from apps.audit.application.services import AuditService
from apps.inventory.application.use_cases import RegisterInventoryMovement
from apps.inventory.infrastructure.models import InventoryMovement, Stock

from ..infrastructure.models import Order, OrderStatusHistory

logger = logging.getLogger(__name__)


class OrderStatusService:
    # Allowed manual transitions for the fulfillment workflow.
    # Internal states (PENDING, PAYMENT_PENDING, PAID, FAILED, CANCELLED, RETURNED)
    # are managed by payment/system flows, not by admin buttons.
    WORKFLOW_TRANSITIONS: dict[str, list[str]] = {
        Order.Status.PAID: [Order.Status.PROCESSING],
        Order.Status.PROCESSING: [Order.Status.PACKED],
        Order.Status.PACKED: [Order.Status.SHIPPED],
        Order.Status.SHIPPED: [Order.Status.DELIVERED],
        Order.Status.IN_TRANSIT: [Order.Status.DELIVERED],
    }

    # States that can be set freely by system/payment flows (bypass workflow check)
    SYSTEM_SOURCES = {"payment", "envios"}

    @classmethod
    def change(cls, *, order, status, actor=None, notes="", source="commerce"):
        if status not in Order.Status.values:
            raise BusinessRuleViolation("El estado solicitado no es válido.")
        if order.status == status:
            return order

        # Enforce workflow transitions when changed from the admin UI
        if source not in cls.SYSTEM_SOURCES:
            allowed = cls.WORKFLOW_TRANSITIONS.get(order.status, [])
            if allowed and status not in allowed:
                raise BusinessRuleViolation(
                    f"No se puede pasar de '{order.get_status_display()}' a '{Order.Status(status).label}'. "
                    f"El estado siguiente permitido es: {', '.join(Order.Status(s).label for s in allowed)}."
                )

        previous_status = order.status
        order.status = status
        order.save(update_fields=("status", "updated_at"))
        OrderStatusHistory.objects.create(
            order=order,
            status=status,
            notes=notes,
            changed_by=actor,
        )
        AuditService.record(
            actor=actor,
            module=source,
            action="ORDER_STATUS_CHANGED",
            resource_type="Order",
            resource_id=order.id,
            metadata={
                "previous_status": previous_status,
                "new_status": status,
                "notes": notes,
            },
        )
        cls._notify_customer(order, status)
        return order

    @staticmethod
    def _notify_customer(order, status):
        from apps.notifications.application.service import NotificationService
        from apps.notifications.infrastructure.models import Notification

        customer = getattr(order, "customer", None)
        if customer is None:
            return

        order_ref = order.number or str(order.id)[:8].upper()

        STATUS_NOTIFICATION = {
            Order.Status.PAID: (
                Notification.Type.ORDER_CONFIRMED,
                "Pago confirmado",
                f"Tu pedido #{order_ref} fue pagado correctamente. Ya lo estamos preparando.",
                "/perfil?s=pedidos",
                True,
            ),
            Order.Status.PROCESSING: (
                Notification.Type.INFO,
                "Pedido en preparación",
                f"Tu pedido #{order_ref} está siendo preparado por nuestro equipo.",
                "/perfil?s=pedidos",
                True,
            ),
            Order.Status.PACKED: (
                Notification.Type.INFO,
                "Pedido empacado",
                f"Tu pedido #{order_ref} ya está empacado y listo para ser enviado.",
                "/perfil?s=pedidos",
                True,
            ),
            Order.Status.SHIPPED: (
                Notification.Type.ORDER_SHIPPED,
                "Tu pedido está en camino",
                f"El pedido #{order_ref} fue despachado y pronto llegará a tu dirección.",
                "/perfil?s=pedidos",
                True,
            ),
            Order.Status.DELIVERED: (
                Notification.Type.ORDER_DELIVERED,
                "Pedido entregado",
                f"El pedido #{order_ref} fue marcado como entregado. ¡Gracias por tu compra!",
                "/perfil?s=pedidos",
                True,
            ),
            Order.Status.CANCELLED: (
                Notification.Type.ORDER_CANCELLED,
                "Pedido cancelado",
                f"El pedido #{order_ref} fue cancelado.",
                "/perfil?s=pedidos",
                True,
            ),
        }

        entry = STATUS_NOTIFICATION.get(status)
        if entry is None:
            return

        notif_type, title, message, action_url, send_email = entry
        try:
            NotificationService.send(
                customer=customer,
                type=notif_type,
                title=title,
                message=message,
                action_url=action_url,
                send_email=send_email,
            )
        except Exception:
            logger.exception("Error al crear notificación para pedido %s.", order.id)


class OrderInventoryService:
    @staticmethod
    def reserve(order):
        if order.inventory_consumed_at:
            raise BusinessRuleViolation("El inventario de este pedido ya fue descontado.")
        if order.inventory_reserved_at and not order.inventory_released_at:
            return
        if not order.fulfillment_location_id:
            raise BusinessRuleViolation("El pedido no tiene una ubicación de inventario asignada.")

        for item in order.items.select_related("variant__product").order_by("variant_id"):
            stock, _ = Stock.objects.select_for_update().get_or_create(
                variant=item.variant,
                location=order.fulfillment_location,
                defaults={"quantity": 0},
            )
            if stock.available_quantity < item.quantity:
                product_name = getattr(getattr(item.variant, "product", None), "name", None) or item.sku
                raise BusinessRuleViolation(
                    f"No hay stock suficiente para «{product_name}». "
                    f"Solo quedan {int(stock.available_quantity)} unidades disponibles."
                )
            stock.reserved_quantity += item.quantity
            stock.save(update_fields=("reserved_quantity", "updated_at"))

        order.inventory_reserved_at = timezone.now()
        order.inventory_released_at = None

    @staticmethod
    def release(order):
        if (
            not order.inventory_reserved_at
            or order.inventory_consumed_at
            or order.inventory_released_at
        ):
            return

        for item in order.items.select_related("variant").order_by("variant_id"):
            stock = Stock.objects.select_for_update().get(
                variant=item.variant,
                location=order.fulfillment_location,
            )
            if stock.reserved_quantity < item.quantity:
                raise BusinessRuleViolation("La reserva de inventario del pedido es inconsistente.")
            stock.reserved_quantity -= item.quantity
            stock.save(update_fields=("reserved_quantity", "updated_at"))

        order.inventory_released_at = timezone.now()

    @staticmethod
    def consume(order, actor=None):
        if order.inventory_consumed_at:
            return
        if not order.inventory_reserved_at or order.inventory_released_at:
            raise BusinessRuleViolation("El pedido no tiene una reserva de inventario activa.")

        inventory = RegisterInventoryMovement()
        for item in order.items.select_related("variant").order_by("variant_id"):
            inventory.execute(
                variant=item.variant,
                location=order.fulfillment_location,
                movement_type=InventoryMovement.Type.EXIT,
                quantity=item.quantity,
                reason="Venta e-commerce pagada",
                reference=order.number,
                actor=actor,
                consume_reserved=True,
            )

        order.inventory_consumed_at = timezone.now()
