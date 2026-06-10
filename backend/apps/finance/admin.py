from django.contrib import admin

from .models import FinancialTransaction


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
