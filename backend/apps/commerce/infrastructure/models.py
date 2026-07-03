import secrets
import string

from django.conf import settings
from django.db import models

from shared.infrastructure.models import BaseModel

ORDER_NUMBER_PREFIX = "JR"
ORDER_NUMBER_LENGTH = 6
ORDER_NUMBER_ALPHABET = string.ascii_uppercase + string.digits


def generate_order_number() -> str:
    suffix = "".join(secrets.choice(ORDER_NUMBER_ALPHABET) for _ in range(ORDER_NUMBER_LENGTH))
    return f"{ORDER_NUMBER_PREFIX}-{suffix}"


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

    class Channel(models.TextChoices):
        ONLINE = "ONLINE", "Venta virtual"
        IN_STORE = "IN_STORE", "Venta presencial"

    number = models.CharField(max_length=40, unique=True, editable=False)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.ONLINE)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    wholesale_code = models.CharField(max_length=40, blank=True)
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
            while True:
                candidate = generate_order_number()
                if not Order.objects.filter(number=candidate).exists():
                    self.number = candidate
                    break
        super().save(*args, **kwargs)


class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT)
    product_name = models.CharField(max_length=180)
    sku = models.CharField(max_length=80)
    presentation = models.CharField(max_length=40, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)


class WholesaleSettings(BaseModel):
    minimum_purchase = models.DecimalField(max_digits=14, decimal_places=2, default=300000)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Configuracion mayorista"
        verbose_name_plural = "Configuracion mayorista"

    def __str__(self):
        return f"Mayorista {self.discount_percentage}% desde {self.minimum_purchase}"

    @classmethod
    def current(cls):
        settings = cls.objects.filter(deleted_at__isnull=True).order_by("-updated_at").first()
        if settings:
            return settings
        return cls.objects.create()


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
