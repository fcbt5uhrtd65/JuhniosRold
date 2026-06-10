from django.contrib import admin

from .models import Cart, CartItem, Order, OrderItem, OrderStatusHistory


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    fields = ("variant", "quantity")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ("variant", "product_name", "sku", "quantity", "unit_price", "subtotal")


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    fields = ("status", "notes", "changed_by", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "checked_out_at", "created_at", "updated_at")
    list_filter = ("checked_out_at",)
    search_fields = ("customer__document_number", "customer__first_name", "customer__last_name")
    list_select_related = ("customer",)
    inlines = (CartItemInline,)


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("cart", "variant", "quantity", "updated_at")
    search_fields = ("variant__sku", "variant__product__name", "cart__customer__document_number")
    list_select_related = ("cart", "cart__customer", "variant", "variant__product")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("number", "customer", "status", "subtotal", "shipping_cost", "total", "created_at")
    list_filter = ("status", "created_at")
    search_fields = (
        "number",
        "customer__document_number",
        "customer__first_name",
        "customer__last_name",
        "tracking_number",
        "payment_reference",
    )
    list_select_related = ("customer",)
    date_hierarchy = "created_at"
    inlines = (OrderItemInline, OrderStatusHistoryInline)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product_name", "sku", "quantity", "unit_price", "subtotal")
    search_fields = ("order__number", "product_name", "sku")
    list_select_related = ("order", "variant")


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("order", "status", "changed_by", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("order__number", "notes", "changed_by__email")
    list_select_related = ("order", "changed_by")
    date_hierarchy = "created_at"
