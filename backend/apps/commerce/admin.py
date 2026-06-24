from django.contrib import admin

from .models import (
    Cart,
    CartItem,
    Order,
    OrderItem,
    OrderStatusHistory,
    Payment,
    PaymentWebhookEvent,
    WholesaleSettings,
)


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    fields = ("variant", "quantity")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ("variant", "product_name", "sku", "presentation", "quantity", "unit_price", "subtotal")


class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    fields = ("status", "notes", "changed_by", "created_at")
    readonly_fields = ("created_at",)


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = (
        "reference",
        "amount_in_cents",
        "currency",
        "status",
        "provider",
        "payment_method",
        "provider_transaction_id",
        "created_at",
    )
    readonly_fields = fields


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
    list_display = ("number", "customer", "status", "subtotal", "discount_amount", "shipping_cost", "total", "created_at")
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
    inlines = (OrderItemInline, PaymentInline, OrderStatusHistoryInline)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product_name", "sku", "presentation", "quantity", "unit_price", "subtotal")
    search_fields = ("order__number", "product_name", "sku")
    list_select_related = ("order", "variant")


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("order", "status", "changed_by", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("order__number", "notes", "changed_by__email")
    list_select_related = ("order", "changed_by")
    date_hierarchy = "created_at"


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "order",
        "amount_in_cents",
        "currency",
        "status",
        "provider",
        "payment_method",
        "provider_transaction_id",
        "created_at",
    )
    list_filter = ("provider", "status", "currency", "payment_method", "created_at")
    search_fields = ("reference", "order__number", "provider_transaction_id")
    readonly_fields = (
        "order",
        "reference",
        "amount_in_cents",
        "currency",
        "status",
        "provider",
        "payment_method",
        "provider_transaction_id",
        "created_at",
        "updated_at",
    )
    list_select_related = ("order",)


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(admin.ModelAdmin):
    list_display = (
        "event_type",
        "reference",
        "transaction_id",
        "transaction_status",
        "environment",
        "processed",
        "created_at",
    )


@admin.register(WholesaleSettings)
class WholesaleSettingsAdmin(admin.ModelAdmin):
    list_display = ("minimum_purchase", "discount_percentage", "is_active", "updated_at")
    fields = ("minimum_purchase", "discount_percentage", "is_active")
    list_filter = ("event_type", "environment", "transaction_status", "processed")
    search_fields = ("checksum", "reference", "transaction_id")
    readonly_fields = (
        "event_type",
        "checksum",
        "environment",
        "event_timestamp",
        "transaction_id",
        "reference",
        "transaction_status",
        "processed",
        "processing_error",
        "created_at",
        "updated_at",
    )
