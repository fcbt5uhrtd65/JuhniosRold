from django.contrib import admin

from .models import FinancialTransaction, SalesInvoice, SalesInvoiceLine


@admin.register(FinancialTransaction)
class FinancialTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "occurred_on",
        "transaction_type",
        "category",
        "amount",
        "reference",
        "created_by",
    )
    list_filter = ("transaction_type", "category", "occurred_on")
    search_fields = ("category", "description", "reference", "created_by__email")
    list_select_related = ("created_by",)
    date_hierarchy = "occurred_on"


class SalesInvoiceLineInline(admin.TabularInline):
    model = SalesInvoiceLine
    extra = 0
    readonly_fields = ("product_name", "sku", "quantity", "unit_price", "subtotal")


@admin.register(SalesInvoice)
class SalesInvoiceAdmin(admin.ModelAdmin):
    list_display = ("number", "order", "customer_name", "status", "total", "issued_at")
    list_filter = ("status", "currency", "issued_at")
    search_fields = ("number", "order__number", "customer_email", "customer_document")
    readonly_fields = (
        "number",
        "order",
        "payment",
        "financial_transaction",
        "status",
        "currency",
        "subtotal",
        "shipping_cost",
        "total",
        "tax_rate",
        "customer_name",
        "customer_email",
        "customer_document",
        "billing_address",
        "issued_at",
        "dian_resolution",
        "created_at",
        "updated_at",
    )
    inlines = (SalesInvoiceLineInline,)
