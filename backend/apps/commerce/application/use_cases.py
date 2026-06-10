from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from apps.inventory.application.use_cases import RegisterInventoryMovement
from apps.inventory.infrastructure.models import InventoryMovement

from ..infrastructure.models import Order, OrderItem, OrderStatusHistory


class CheckoutCart:
    @transaction.atomic
    def execute(self, *, cart, location, shipping_address, actor=None):
        items = list(cart.items.select_related("variant__product").prefetch_related("variant__prices"))
        if not items:
            raise BusinessRuleViolation("El carrito está vacío.")

        order = Order.objects.create(
            customer=cart.customer,
            shipping_address=shipping_address,
            status=Order.Status.PENDING,
        )
        total = Decimal("0")
        inventory = RegisterInventoryMovement()

        for cart_item in items:
            price = cart_item.variant.prices.filter(is_active=True).order_by("-valid_from").first()
            if not price:
                raise BusinessRuleViolation(f"La variante {cart_item.variant.sku} no tiene un precio activo.")
            line_total = price.amount * cart_item.quantity
            total += line_total
            OrderItem.objects.create(
                order=order,
                variant=cart_item.variant,
                product_name=cart_item.variant.product.name,
                sku=cart_item.variant.sku,
                quantity=cart_item.quantity,
                unit_price=price.amount,
                subtotal=line_total,
            )
            inventory.execute(
                variant=cart_item.variant,
                location=location,
                movement_type=InventoryMovement.Type.EXIT,
                quantity=cart_item.quantity,
                reason="Venta e-commerce",
                reference=order.number,
                actor=actor,
            )

        order.subtotal = total
        order.total = total
        order.save(update_fields=("subtotal", "total", "updated_at"))
        OrderStatusHistory.objects.create(order=order, status=order.status, changed_by=actor)
        cart.checked_out_at = timezone.now()
        cart.save(update_fields=("checked_out_at", "updated_at"))
        return order


class CancelOrder:
    @transaction.atomic
    def execute(self, order, actor=None):
        if order.status in (Order.Status.CANCELLED, Order.Status.DELIVERED):
            raise BusinessRuleViolation("El pedido no puede cancelarse en su estado actual.")
        order.status = Order.Status.CANCELLED
        order.save(update_fields=("status", "updated_at"))
        OrderStatusHistory.objects.create(order=order, status=order.status, changed_by=actor)
        return order
