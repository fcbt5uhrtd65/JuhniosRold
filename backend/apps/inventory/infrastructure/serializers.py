from rest_framework import serializers

from ..application.use_cases import RegisterInventoryMovement
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


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = "__all__"


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = "__all__"


class StockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = "__all__"
        read_only_fields = ("quantity",)


class InventoryMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryMovement
        fields = "__all__"
        read_only_fields = ("created_by",)

    def create(self, validated_data):
        request = self.context["request"]
        return RegisterInventoryMovement().execute(
            **validated_data,
            actor=request.user if request.user.is_authenticated else None,
        )


# ── Maestros ────────────────────────────────────────────────────────────────

class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = "__all__"


class ItemGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemGroup
        fields = "__all__"


class ItemTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemType
        fields = "__all__"


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = "__all__"


# ── Compras ─────────────────────────────────────────────────────────────────

class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderLine
        fields = ("id", "item", "quantity", "unit_price", "received_quantity")


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseOrderLineSerializer(many=True, required=False)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = (
            "id",
            "number",
            "supplier",
            "status",
            "issued_at",
            "expected_at",
            "destination_location",
            "notes",
            "created_by",
            "total",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("number", "created_by")

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        order = PurchaseOrder.objects.create(**validated_data)
        PurchaseOrderLine.objects.bulk_create(
            PurchaseOrderLine(order=order, **line) for line in lines_data
        )
        return order


# ── Producción ──────────────────────────────────────────────────────────────

class FormulaLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormulaLine
        fields = ("id", "item", "quantity")


class FormulaSerializer(serializers.ModelSerializer):
    lines = FormulaLineSerializer(many=True, required=False)

    class Meta:
        model = Formula
        fields = (
            "id",
            "code",
            "name",
            "output_item",
            "yield_quantity",
            "yield_unit",
            "is_active",
            "lines",
        )

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        formula = Formula.objects.create(**validated_data)
        FormulaLine.objects.bulk_create(
            FormulaLine(formula=formula, **line) for line in lines_data
        )
        return formula


class ProductionOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionOrder
        fields = "__all__"
        read_only_fields = ("number",)


# ── Conversión ────────────────────────────────────────────────────────────

class StockConversionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockConversion
        fields = "__all__"
        read_only_fields = ("number", "created_by")

    def create(self, validated_data):
        request = self.context["request"]
        validated_data["created_by"] = request.user if request.user.is_authenticated else None
        return super().create(validated_data)
