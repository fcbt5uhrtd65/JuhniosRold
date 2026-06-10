from django.conf import settings
from django.db import models

from shared.infrastructure.models import BaseModel


class Warehouse(BaseModel):
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=30, unique=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Location(BaseModel):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="locations")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=40)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("warehouse", "code"), name="unique_location_code_per_warehouse")
        ]

    def __str__(self):
        return f"{self.warehouse.code}/{self.code}"


class Stock(BaseModel):
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT, related_name="stocks")
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="stocks")
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    minimum_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("variant", "location"), name="unique_stock_per_variant_location"),
            models.CheckConstraint(condition=models.Q(quantity__gte=0), name="stock_quantity_non_negative"),
        ]


class InventoryMovement(BaseModel):
    class Type(models.TextChoices):
        ENTRY = "ENTRY", "Entrada"
        EXIT = "EXIT", "Salida"
        LOSS = "LOSS", "Merma"
        ADJUSTMENT_IN = "ADJUSTMENT_IN", "Ajuste positivo"
        ADJUSTMENT_OUT = "ADJUSTMENT_OUT", "Ajuste negativo"

    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT, related_name="movements")
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="movements")
    movement_type = models.CharField(max_length=30, choices=Type.choices)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    reason = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_movements",
    )
