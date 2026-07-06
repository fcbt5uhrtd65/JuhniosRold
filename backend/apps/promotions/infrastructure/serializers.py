from rest_framework import serializers

from .models import Promotion


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
