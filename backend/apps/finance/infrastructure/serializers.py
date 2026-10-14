import re
from decimal import Decimal

from rest_framework import serializers

from .models import (
    FinancialTransaction,
    PaymentAccount,
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
            "presentation",
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
            "customer_business_name",
            "customer_email",
            "customer_document",
            "billing_address",
            "issued_at",
            "dian_resolution",
            "lines",
        )


DOCUMENT_PATTERN = re.compile(r"^[0-9.\-\s]{5,30}$")
SIGNATURE_MAX_BYTES = 300 * 1024


class PaymentAccountSerializer(serializers.ModelSerializer):
    id_number = serializers.IntegerField(source="number", read_only=True)

    class Meta:
        model = PaymentAccount
        fields = (
            "id",
            "id_number",
            "issue_date",
            "service_title",
            "contractor_name",
            "contractor_document",
            "contractor_document_city",
            "contractor_address",
            "contractor_city",
            "contractor_email",
            "contractor_phone",
            "client_name",
            "client_branch",
            "client_document",
            "client_address",
            "client_city",
            "client_legal_rep",
            "client_legal_rep_document",
            "description",
            "contract_reference",
            "period_start",
            "period_end",
            "supervisor",
            "requisition_number",
            "requisition_date",
            "amount",
            "vat_note",
            "no_withholding_letter",
            "contract_object",
            "monthly_value",
            "bank_name",
            "account_type",
            "account_number",
            "account_holder",
            "account_holder_document",
            "signature",
            "created_by",
            "created_at",
        )
        read_only_fields = ("id", "id_number", "created_by", "created_at")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        view = self.context.get("view")
        if getattr(view, "action", None) == "list":
            # La firma pesa hasta 300 KB: en el listado solo se indica si existe.
            data["has_signature"] = bool(data.pop("signature", ""))
        return data

    def _validate_document(self, value):
        value = (value or "").strip()
        if value and not DOCUMENT_PATTERN.match(value):
            raise serializers.ValidationError(
                "Solo dígitos, puntos, guiones y espacios (5 a 30 caracteres)."
            )
        return value

    def validate_amount(self, value):
        if value is None or value <= Decimal("0"):
            raise serializers.ValidationError("El monto debe ser mayor que cero.")
        return value

    def validate_contractor_document(self, value):
        value = self._validate_document(value)
        if not value:
            raise serializers.ValidationError("Este campo es obligatorio.")
        return value

    def validate_account_holder_document(self, value):
        return self._validate_document(value)

    def validate_signature(self, value):
        if not value:
            return ""
        if not value.startswith("data:image/"):
            raise serializers.ValidationError("La firma debe ser una imagen (data:image/...).")
        if len(value.encode("utf-8")) > SIGNATURE_MAX_BYTES:
            raise serializers.ValidationError("La firma supera el máximo de 300 KB.")
        return value

    def validate(self, attrs):
        start, end = attrs.get("period_start"), attrs.get("period_end")
        if start and end and end < start:
            raise serializers.ValidationError(
                {"period_end": "La fecha final no puede ser anterior a la inicial."}
            )
        if attrs.get("no_withholding_letter"):
            if not (attrs.get("contract_object") or "").strip():
                raise serializers.ValidationError(
                    {"contract_object": "El objeto del contrato es obligatorio con el certificado."}
                )
        else:
            attrs["monthly_value"] = None
        return attrs
