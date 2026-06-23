from django.contrib import admin
from django.db.models import F

from .models import (
    Formula,
    FormulaLine,
    InventoryMovement,
    Item,
    ItemGroup,
    ItemType,
    Location,
    ProductionOrder,
    PurchaseOrder,
    PurchaseOrderLine,
    Stock,
    StockConversion,
    Supplier,
    UnitOfMeasure,
    Warehouse,
)


class LocationInline(admin.TabularInline):
    model = Location
    extra = 0
    fields = ("code", "name", "is_active")


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name", "address")
    inlines = (LocationInline,)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "warehouse", "is_active", "updated_at")
    list_filter = ("is_active", "warehouse")
    search_fields = ("code", "name", "warehouse__name", "warehouse__code")
    list_select_related = ("warehouse",)


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("variant", "location", "quantity", "minimum_quantity", "is_critical")
    list_filter = ("location__warehouse", "location")
    search_fields = ("variant__sku", "variant__product__name", "location__code")
    list_select_related = ("variant", "variant__product", "location", "location__warehouse")

    @admin.display(boolean=True, description="Stock crítico")
    def is_critical(self, stock):
        return stock.quantity <= stock.minimum_quantity

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            critical_stock=F("quantity") - F("minimum_quantity")
        )


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "variant",
        "location",
        "movement_type",
        "quantity",
        "reference",
        "created_by",
    )
    list_filter = ("movement_type", "location__warehouse", "created_at")
    search_fields = (
        "variant__sku",
        "variant__product__name",
        "reference",
        "reason",
        "created_by__email",
    )
    list_select_related = ("variant", "variant__product", "location", "created_by")
    date_hierarchy = "created_at"


@admin.register(UnitOfMeasure)
class UnitOfMeasureAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "abbreviation")
    search_fields = ("code", "name", "abbreviation")


@admin.register(ItemGroup)
class ItemGroupAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_inventoried")
    search_fields = ("code", "name")


@admin.register(ItemType)
class ItemTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "is_inventoried")
    search_fields = ("name",)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("nit", "name", "contact_name", "city", "is_active")
    list_filter = ("is_active", "city")
    search_fields = ("nit", "name", "contact_name")


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "item_type", "item_group", "unit", "cost", "minimum_quantity", "is_active")
    list_filter = ("item_type", "item_group", "is_active")
    search_fields = ("code", "name")
    list_select_related = ("item_type", "item_group", "unit", "supplier")


class PurchaseOrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 0


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("number", "supplier", "status", "issued_at", "expected_at", "total")
    list_filter = ("status", "issued_at")
    search_fields = ("number", "supplier__name")
    list_select_related = ("supplier",)
    inlines = (PurchaseOrderLineInline,)


class FormulaLineInline(admin.TabularInline):
    model = FormulaLine
    extra = 0


@admin.register(Formula)
class FormulaAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "output_item", "yield_quantity", "yield_unit", "is_active")
    search_fields = ("code", "name")
    list_select_related = ("output_item", "yield_unit")
    inlines = (FormulaLineInline,)


@admin.register(ProductionOrder)
class ProductionOrderAdmin(admin.ModelAdmin):
    list_display = (
        "number",
        "formula",
        "output_item",
        "status",
        "planned_quantity",
        "actual_quantity",
        "started_at",
        "closed_at",
    )
    list_filter = ("status",)
    search_fields = ("number", "batch_code")
    list_select_related = ("formula", "output_item")


@admin.register(StockConversion)
class StockConversionAdmin(admin.ModelAdmin):
    list_display = (
        "number",
        "occurred_on",
        "source_item",
        "source_quantity",
        "target_item",
        "target_quantity",
    )
    search_fields = ("number", "reason")
    list_select_related = ("source_item", "target_item")
    date_hierarchy = "occurred_on"
