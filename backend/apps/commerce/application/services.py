from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from apps.audit.application.services import AuditService
from apps.inventory.application.use_cases import RegisterInventoryMovement
from apps.inventory.infrastructure.models import InventoryMovement, Stock

from ..infrastructure.models import Order, OrderStatusHistory


class OrderStatusService:
    @staticmethod
    def change(*, order, status, actor=None, notes="", source="commerce"):
        if status not in Order.Status.values:
            raise BusinessRuleViolation("El estado solicitado no es válido.")
        if order.status == status:
            return order

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
        return order


class OrderInventoryService:
    @staticmethod
    def reserve(order):
        if order.inventory_consumed_at:
            raise BusinessRuleViolation("El inventario de este pedido ya fue descontado.")
        if order.inventory_reserved_at and not order.inventory_released_at:
            return
        if not order.fulfillment_location_id:
            raise BusinessRuleViolation("El pedido no tiene una ubicación de inventario asignada.")

        for item in order.items.select_related("variant").order_by("variant_id"):
            stock, _ = Stock.objects.select_for_update().get_or_create(
                variant=item.variant,
                location=order.fulfillment_location,
                defaults={"quantity": 0},
            )
            if stock.available_quantity < item.quantity:
                raise BusinessRuleViolation(
                    f"No hay stock disponible para la variante {item.sku}."
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
