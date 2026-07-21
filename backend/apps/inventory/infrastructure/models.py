import uuid
from decimal import Decimal

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
    reserved_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    minimum_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(fields=("variant", "location"), name="unique_stock_per_variant_location"),
            models.CheckConstraint(condition=models.Q(quantity__gte=0), name="stock_quantity_non_negative"),
            models.CheckConstraint(
                condition=models.Q(reserved_quantity__gte=0),
                name="stock_reserved_quantity_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(reserved_quantity__lte=models.F("quantity")),
                name="stock_reserved_quantity_lte_quantity",
            ),
        ]

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity


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


# ── Maestros ────────────────────────────────────────────────────────────────

class UnitOfMeasure(BaseModel):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=80)
    abbreviation = models.CharField(max_length=10)

    def __str__(self):
        return self.abbreviation


class ItemGroup(BaseModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    is_inventoried = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class ItemType(BaseModel):
    name = models.CharField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    is_inventoried = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Supplier(BaseModel):
    nit = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=180)
    contact_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    city = models.CharField(max_length=80, blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Item(BaseModel):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=180)
    item_type = models.ForeignKey(ItemType, on_delete=models.PROTECT, related_name="items")
    item_group = models.ForeignKey(ItemGroup, on_delete=models.PROTECT, related_name="items")
    unit = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, related_name="items")
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="items",
        null=True,
        blank=True,
    )
    # Enlace opcional al producto/variante del catálogo comercial, para que las
    # órdenes de producción de producto terminado (Formula.output_item) puedan
    # mostrar el producto, código y presentación reales de catálogo cuando el
    # Item represente un producto terminado ya publicado en catalog.ProductVariant.
    product_variant = models.ForeignKey(
        "catalog.ProductVariant",
        on_delete=models.SET_NULL,
        related_name="inventory_items",
        null=True,
        blank=True,
    )
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    minimum_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    maximum_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    description = models.TextField(blank=True)
    tracks_inventory = models.BooleanField(default=True)
    tracks_batches = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} - {self.name}"


# ── Compras ─────────────────────────────────────────────────────────────────

class PurchaseOrder(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        SENT = "SENT", "Enviada"
        PARTIAL = "PARTIAL", "Parcial"
        CLOSED = "CLOSED", "Cerrada"
        VOIDED = "VOIDED", "Anulada"

    number = models.CharField(max_length=40, unique=True, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    issued_at = models.DateField()
    expected_at = models.DateField(null=True, blank=True)
    destination_location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )

    @property
    def total(self):
        return sum((line.quantity * line.unit_price for line in self.lines.all()), Decimal("0"))

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = f"OC-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)


class PurchaseOrderLine(BaseModel):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="purchase_order_lines")
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    received_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)


# ── Producción ──────────────────────────────────────────────────────────────

class Formula(BaseModel):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=180)
    output_item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="formulas")
    yield_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    yield_unit = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, related_name="formulas")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.code} - {self.name}"


class FormulaLine(BaseModel):
    formula = models.ForeignKey(Formula, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="formula_lines")
    quantity = models.DecimalField(max_digits=14, decimal_places=3)


class ProductionOrder(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        IN_PROGRESS = "IN_PROGRESS", "En proceso"
        CLOSED = "CLOSED", "Cerrada"
        VOIDED = "VOIDED", "Anulada"

    number = models.CharField(max_length=40, unique=True, editable=False)
    formula = models.ForeignKey(Formula, on_delete=models.PROTECT, related_name="production_orders")
    output_item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="production_orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    planned_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    actual_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    batch_code = models.CharField(max_length=60, blank=True)
    started_at = models.DateField(null=True, blank=True)
    closed_at = models.DateField(null=True, blank=True)
    responsible = models.CharField(max_length=120, blank=True)
    is_dispensed = models.BooleanField(default=False)
    is_output_received = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = f"OP-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)


# ── Conversión ────────────────────────────────────────────────────────────

class StockConversion(BaseModel):
    number = models.CharField(max_length=40, unique=True, editable=False)
    occurred_on = models.DateField()
    source_item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="conversions_out")
    source_location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="conversions_out")
    source_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    target_item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="conversions_in")
    target_location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="conversions_in")
    target_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    reason = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_conversions",
    )

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = f"CV-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)
