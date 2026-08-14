from decimal import Decimal
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import Promotion, SellerDiscountCode, normalize_seller_discount_code


class PromotionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = "__all__"

    def validate(self, attrs):
        instance = self.instance or Promotion()
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.clean()
        return attrs


class PromotionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = ("id", "name", "discount_type", "discount_value", "ends_at")


class SellerDiscountCodeSerializer(serializers.ModelSerializer):
    seller_name = serializers.SerializerMethodField()
    duration_hours = serializers.IntegerField(write_only=True, required=False, min_value=1, max_value=720)

    class Meta:
        model = SellerDiscountCode
        fields = "__all__"
        read_only_fields = ("created_by", "uses_count")
        extra_kwargs = {
            "code": {"required": False, "allow_blank": True},
            "starts_at": {"required": False},
            "ends_at": {"required": False},
        }

    def validate_code(self, value):
        return normalize_seller_discount_code(value)

    def get_seller_name(self, obj):
        return obj.seller_name

    def validate(self, attrs):
        duration_hours = attrs.pop("duration_hours", None)
        if not attrs.get("starts_at") and not getattr(self.instance, "starts_at", None):
            attrs["starts_at"] = timezone.now()
        if duration_hours and not attrs.get("ends_at"):
            start = attrs.get("starts_at") or getattr(self.instance, "starts_at", None) or timezone.now()
            attrs["starts_at"] = start
            attrs["ends_at"] = start + timedelta(hours=duration_hours)
        if not attrs.get("ends_at") and not getattr(self.instance, "ends_at", None):
            raise serializers.ValidationError({"ends_at": ["Debes indicar una fecha final o una duracion en horas."]})

        instance = self.instance or SellerDiscountCode()
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.clean()
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if getattr(user, "is_authenticated", False):
            validated_data["created_by"] = user
        seller = validated_data.get("seller")
        if seller and not seller.is_salesperson:
            seller.is_salesperson = True
            seller.save(update_fields=("is_salesperson", "updated_at"))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        seller = validated_data.get("seller")
        if seller and not seller.is_salesperson:
            seller.is_salesperson = True
            seller.save(update_fields=("is_salesperson", "updated_at"))
        return super().update(instance, validated_data)


class SellerDiscountCodeValidationSerializer(serializers.Serializer):
    code = serializers.CharField()
    subtotal = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, min_value=Decimal("0"))

    def validate_code(self, value):
        return normalize_seller_discount_code(value)
