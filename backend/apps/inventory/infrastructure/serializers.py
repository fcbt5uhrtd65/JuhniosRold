from rest_framework import serializers

from ..application.use_cases import RegisterInventoryMovement
from .models import InventoryMovement, Location, Stock, Warehouse


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
