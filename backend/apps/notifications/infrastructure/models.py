from django.db import models

from shared.infrastructure.models import BaseModel


class Notification(BaseModel):
    class Type(models.TextChoices):
        ORDER_CONFIRMED  = "order_confirmed",  "Pedido confirmado"
        ORDER_SHIPPED    = "order_shipped",    "Pedido en camino"
        ORDER_DELIVERED  = "order_delivered",  "Pedido entregado"
        ORDER_CANCELLED  = "order_cancelled",  "Pedido cancelado"
        WHOLESALE_ACTIVATED = "wholesale_activated", "Plan mayorista activado"
        PROMO            = "promo",            "Promoción"
        INFO             = "info",             "Información"

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    order = models.ForeignKey(
        "commerce.Order",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=30, choices=Type.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    action_url = models.CharField(max_length=500, blank=True)
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        indexes = [
            models.Index(fields=["customer", "-created_at"]),
            models.Index(fields=["customer", "read"]),
        ]

    def __str__(self):
        return f"[{self.type}] {self.title} → {self.customer}"
