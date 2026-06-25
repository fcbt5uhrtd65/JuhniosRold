from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from apps.catalog.infrastructure.models import ProductVariant

from ..services import OrderInventoryService
from ...infrastructure.models import Cart, Order, OrderItem, OrderStatusHistory, WholesaleSettings


def _presentation_label(variant):
    label = getattr(variant, "presentation_label", "")
    return label or variant.name


def _wholesale_discount(subtotal, customer=None):
    from apps.customers.infrastructure.models import Customer
    if customer is None or getattr(customer, "purchase_mode", None) != Customer.PurchaseMode.WHOLESALE:
        return Decimal("0")
    ws = WholesaleSettings.current()
    if not ws.is_active or subtotal < ws.minimum_purchase:
        return Decimal("0")
    return (subtotal * (ws.discount_percentage / Decimal("100"))).quantize(Decimal("0.01"))


class CheckoutCart:
    @transaction.atomic
    def execute(self, *, cart, location, shipping_address, actor=None, wholesale_code=""):
        cart = Cart.objects.select_for_update().get(pk=cart.pk)
        if cart.checked_out_at:
            raise BusinessRuleViolation("El carrito ya fue procesado.")
        items = list(
            cart.items.select_for_update()
            .select_related("variant__product")
            .prefetch_related("variant__prices")
        )
        if not items:
            raise BusinessRuleViolation("El carrito está vacío.")

        order = Order.objects.create(
            customer=cart.customer,
            shipping_address=shipping_address,
            fulfillment_location=location,
            status=Order.Status.PENDING,
        )
        total = Decimal("0")

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
                presentation=_presentation_label(cart_item.variant),
                quantity=cart_item.quantity,
                unit_price=price.amount,
                subtotal=line_total,
            )

        discount_amount = _wholesale_discount(total, cart.customer)
        payable_subtotal = max(Decimal("0"), total - discount_amount)
        shipping_cost = (
            Decimal("0")
            if payable_subtotal >= settings.ECOMMERCE_FREE_SHIPPING_THRESHOLD
            else settings.ECOMMERCE_SHIPPING_COST
        )
        order.subtotal = total
        order.discount_amount = discount_amount
        order.shipping_cost = shipping_cost
        order.total = payable_subtotal + shipping_cost
        order.wholesale_code = wholesale_code or getattr(cart.customer, "wholesale_code", "")
        OrderInventoryService.reserve(order)
        order.save(
            update_fields=(
                "subtotal",
                "discount_amount",
                "wholesale_code",
                "shipping_cost",
                "total",
                "inventory_reserved_at",
                "inventory_released_at",
                "updated_at",
            )
        )
        OrderStatusHistory.objects.create(order=order, status=order.status, changed_by=actor)
        cart.checked_out_at = timezone.now()
        cart.save(update_fields=("checked_out_at", "updated_at"))
        return order


class CreateOrder:
    @transaction.atomic
    def execute(self, *, customer, location, shipping_address, items, actor=None, wholesale_code=""):
        if not items:
            raise BusinessRuleViolation("El pedido debe contener al menos un producto.")

        order = Order.objects.create(
            customer=customer,
            shipping_address=shipping_address,
            fulfillment_location=location,
            status=Order.Status.PENDING,
        )
        subtotal = Decimal("0")

        for requested_item in items:
            variant = (
                ProductVariant.objects.select_related("product")
                .prefetch_related("prices")
                .filter(pk=requested_item["variant_id"], is_active=True)
                .first()
            )
            if variant is None:
                raise BusinessRuleViolation("La variante solicitada no existe o está inactiva.")
            price = variant.prices.filter(is_active=True).order_by("-valid_from").first()
            if not price:
                raise BusinessRuleViolation(
                    f"La variante {variant.sku} no tiene un precio activo."
                )
            quantity = requested_item["quantity"]
            line_total = price.amount * quantity
            subtotal += line_total
            OrderItem.objects.create(
                order=order,
                variant=variant,
                product_name=variant.product.name,
                sku=variant.sku,
                presentation=_presentation_label(variant),
                quantity=quantity,
                unit_price=price.amount,
                subtotal=line_total,
            )

        discount_amount = _wholesale_discount(subtotal, customer)
        payable_subtotal = max(Decimal("0"), subtotal - discount_amount)
        shipping_cost = (
            Decimal("0")
            if payable_subtotal >= settings.ECOMMERCE_FREE_SHIPPING_THRESHOLD
            else settings.ECOMMERCE_SHIPPING_COST
        )
        order.subtotal = subtotal
        order.discount_amount = discount_amount
        order.shipping_cost = shipping_cost
        order.total = payable_subtotal + shipping_cost
        order.wholesale_code = wholesale_code or getattr(customer, "wholesale_code", "")
        OrderInventoryService.reserve(order)
        order.save(
            update_fields=(
                "subtotal",
                "discount_amount",
                "wholesale_code",
                "shipping_cost",
                "total",
                "inventory_reserved_at",
                "inventory_released_at",
                "updated_at",
            )
        )
        OrderStatusHistory.objects.create(order=order, status=order.status, changed_by=actor)
        return order


class CancelOrder:
    @transaction.atomic
    def execute(self, order, actor=None):
        order = Order.objects.select_for_update().get(pk=order.pk)
        if order.status in (Order.Status.CANCELLED, Order.Status.DELIVERED, Order.Status.PAID):
            raise BusinessRuleViolation("El pedido no puede cancelarse en su estado actual.")

        OrderInventoryService.release(order)
        order.status = Order.Status.CANCELLED
        order.save(update_fields=("status", "inventory_released_at", "updated_at"))
        OrderStatusHistory.objects.create(order=order, status=order.status, changed_by=actor)
        return order
