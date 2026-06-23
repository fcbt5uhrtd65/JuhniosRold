from rest_framework import serializers

from .models import (
    FinancialTransaction,
    SalesInvoice,
    SalesInvoiceLine,
)


class FinancialTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialTransaction
        fields = "__all__"
        read_only_fields = ("created_by",)


class SalesInvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesInvoiceLine
        fields = (
            "id",
            "product_name",
            "sku",
            "quantity",
            "unit_price",
            "subtotal",
        )


class SalesInvoiceSerializer(serializers.ModelSerializer):
    lines = SalesInvoiceLineSerializer(many=True, read_only=True)
    order_number = serializers.CharField(source="order.number", read_only=True)

    class Meta:
        model = SalesInvoice
        fields = (
            "id",
            "number",
            "order",
            "order_number",
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
            "lines",
        )
