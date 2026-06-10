from django.contrib import admin
from django.db.models import F

from .models import InventoryMovement, Location, Stock, Warehouse


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
