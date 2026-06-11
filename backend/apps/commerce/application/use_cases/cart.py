from django.db import IntegrityError, transaction

from shared.domain.exceptions import BusinessRuleViolation

from apps.catalog.infrastructure.models import ProductVariant

from ...infrastructure.models import Cart, CartItem


class ActiveCartService:
    @staticmethod
    def get_or_create(customer):
        cart = (
            Cart.objects.filter(customer=customer, checked_out_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if cart:
            return cart
        try:
            with transaction.atomic():
                return Cart.objects.create(customer=customer)
        except IntegrityError:
            return Cart.objects.get(customer=customer, checked_out_at__isnull=True)

    @transaction.atomic
    def add_item(self, *, customer, variant_id, quantity):
        if quantity <= 0:
            raise BusinessRuleViolation("La cantidad debe ser mayor que cero.")
        variant = (
            ProductVariant.objects.select_related("product")
            .prefetch_related("prices")
            .filter(pk=variant_id, is_active=True, product__is_active=True)
            .first()
        )
        if not variant:
            raise BusinessRuleViolation("La variante no existe o no está disponible.")
        if not variant.prices.filter(is_active=True).exists():
            raise BusinessRuleViolation("La variante no tiene un precio activo.")

        cart = self.get_or_create(customer)
        cart = Cart.objects.select_for_update().get(pk=cart.pk)
        item = CartItem.all_objects.filter(cart=cart, variant=variant).first()
        if item:
            item.deleted_at = None
            item.quantity += quantity
            item.save(update_fields=("quantity", "deleted_at", "updated_at"))
        else:
            item = CartItem.objects.create(
                cart=cart,
                variant=variant,
                quantity=quantity,
            )
        return cart

    @transaction.atomic
    def update_item(self, *, customer, item_id, quantity):
        if quantity <= 0:
            raise BusinessRuleViolation("La cantidad debe ser mayor que cero.")
        item = CartItem.objects.select_for_update().get(
            pk=item_id,
            cart__customer=customer,
            cart__checked_out_at__isnull=True,
        )
        item.quantity = quantity
        item.save(update_fields=("quantity", "updated_at"))
        return item.cart

    @transaction.atomic
    def remove_item(self, *, customer, item_id):
        item = CartItem.objects.select_for_update().get(
            pk=item_id,
            cart__customer=customer,
            cart__checked_out_at__isnull=True,
        )
        cart = item.cart
        item.delete()
        return cart

    @transaction.atomic
    def clear(self, *, customer):
        cart = self.get_or_create(customer)
        CartItem.objects.filter(cart=cart).delete()
        return cart

    @transaction.atomic
    def restore_order_items(self, *, order):
        order.refresh_from_db(fields=("restored_cart",))
        if order.restored_cart_id:
            return order.restored_cart

        cart = self.get_or_create(order.customer)
        cart = Cart.objects.select_for_update().get(pk=cart.pk)
        for order_item in order.items.select_related("variant"):
            item = CartItem.all_objects.filter(
                cart=cart,
                variant=order_item.variant,
            ).first()
            if item:
                item.deleted_at = None
                item.quantity += order_item.quantity
                item.save(update_fields=("quantity", "deleted_at", "updated_at"))
            else:
                CartItem.objects.create(
                    cart=cart,
                    variant=order_item.variant,
                    quantity=order_item.quantity,
                )

        order.restored_cart = cart
        order.save(update_fields=("restored_cart", "updated_at"))
        return cart

    @transaction.atomic
    def remove_restored_order_items(self, *, order):
        order.refresh_from_db(fields=("restored_cart",))
        cart = order.restored_cart
        if not cart:
            return

        cart = Cart.objects.select_for_update().get(pk=cart.pk)
        if cart.checked_out_at is None:
            for order_item in order.items.select_related("variant"):
                item = CartItem.objects.filter(
                    cart=cart,
                    variant=order_item.variant,
                ).first()
                if not item:
                    continue
                remaining = item.quantity - order_item.quantity
                if remaining > 0:
                    item.quantity = remaining
                    item.save(update_fields=("quantity", "updated_at"))
                else:
                    item.delete()

        order.restored_cart = None
        order.save(update_fields=("restored_cart", "updated_at"))
