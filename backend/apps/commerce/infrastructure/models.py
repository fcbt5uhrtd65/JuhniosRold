import uuid

from django.conf import settings
from django.db import models

from shared.infrastructure.models import BaseModel


class Cart(BaseModel):
    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE, related_name="carts")
    checked_out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("customer",),
                condition=models.Q(checked_out_at__isnull=True, deleted_at__isnull=True),
                name="unique_active_cart_per_customer",
            )
        ]


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
        PAYMENT_PENDING = "PAYMENT_PENDING", "En pago"
        PAID = "PAID", "Pagado"
        FAILED = "FAILED", "Fallido"
        CONFIRMED = "CONFIRMED", "Confirmado"
        PROCESSING = "PROCESSING", "En preparación"
        PACKED = "PACKED", "Empacado"
        SHIPPED = "SHIPPED", "Despachado"
        IN_TRANSIT = "IN_TRANSIT", "En camino"
        DELIVERED = "DELIVERED", "Entregado"
        CANCELLED = "CANCELLED", "Cancelado"
        RETURNED = "RETURNED", "Devuelto"

    number = models.CharField(max_length=40, unique=True, editable=False)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    shipping_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    shipping_address = models.TextField()
    fulfillment_location = models.ForeignKey(
        "inventory.Location",
        on_delete=models.PROTECT,
        related_name="orders",
        null=True,
        blank=True,
    )
    tracking_number = models.CharField(max_length=120, blank=True)
    payment_reference = models.CharField(max_length=120, blank=True)
    inventory_reserved_at = models.DateTimeField(null=True, blank=True)
    inventory_consumed_at = models.DateTimeField(null=True, blank=True)
    inventory_released_at = models.DateTimeField(null=True, blank=True)
    restored_cart = models.ForeignKey(
        Cart,
        on_delete=models.SET_NULL,
        related_name="restored_orders",
        null=True,
        blank=True,
    )

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


class Payment(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        APPROVED = "APPROVED", "Aprobado"
        DECLINED = "DECLINED", "Rechazado"
        ERROR = "ERROR", "Error"
        VOIDED = "VOIDED", "Anulado"
        EXPIRED = "EXPIRED", "Expirado"

    class Provider(models.TextChoices):
        MOCK = "MOCK", "Simulado"
        WOMPI = "WOMPI", "Wompi"

    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="payments")
    provider = models.CharField(
        max_length=20,
        choices=Provider.choices,
        default=Provider.WOMPI,
    )
    reference = models.CharField(max_length=255, unique=True)
    amount_in_cents = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3, default="COP")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=40, blank=True)
    provider_transaction_id = models.CharField(
        max_length=120,
        unique=True,
        null=True,
        blank=True,
    )


class PaymentWebhookEvent(BaseModel):
    event_type = models.CharField(max_length=80)
    checksum = models.CharField(max_length=64, unique=True)
    environment = models.CharField(max_length=20)
    event_timestamp = models.BigIntegerField()
    transaction_id = models.CharField(max_length=120, blank=True)
    reference = models.CharField(max_length=255, blank=True)
    transaction_status = models.CharField(max_length=30, blank=True)
    processed = models.BooleanField(default=False)
    processing_error = models.TextField(blank=True)
