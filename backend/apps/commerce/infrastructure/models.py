import uuid

from django.conf import settings
from django.db import models

from shared.infrastructure.models import BaseModel


class Cart(BaseModel):
    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE, related_name="carts")
    checked_out_at = models.DateTimeField(null=True, blank=True)


class CartItem(BaseModel):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("cart", "variant"), name="unique_variant_per_cart")
        ]


class Order(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        CONFIRMED = "CONFIRMED", "Confirmado"
        PROCESSING = "PROCESSING", "En preparación"
        SHIPPED = "SHIPPED", "Enviado"
        DELIVERED = "DELIVERED", "Entregado"
        CANCELLED = "CANCELLED", "Cancelado"

    number = models.CharField(max_length=40, unique=True, editable=False)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    shipping_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    shipping_address = models.TextField()
    tracking_number = models.CharField(max_length=120, blank=True)
    payment_reference = models.CharField(max_length=120, blank=True)

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = f"JR-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)


class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT)
    product_name = models.CharField(max_length=180)
    sku = models.CharField(max_length=80)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)


class OrderStatusHistory(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="status_history")
    status = models.CharField(max_length=20, choices=Order.Status.choices)
    notes = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
