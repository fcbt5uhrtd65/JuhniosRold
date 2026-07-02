from rest_framework import serializers

from .models import ReferralCode, ReferralRedemption


class ReferralCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralCode
        fields = ("id", "code", "created_at")
        read_only_fields = fields


class ReferralRedemptionSerializer(serializers.ModelSerializer):
    referrer_name = serializers.SerializerMethodField()
    referred_name = serializers.SerializerMethodField()
    referral_code_value = serializers.CharField(source="referral_code.code", read_only=True)

    class Meta:
        model = ReferralRedemption
        fields = (
            "id",
            "referral_code",
            "referral_code_value",
            "referrer_customer",
            "referrer_name",
            "referred_customer",
            "referred_name",
            "status",
            "redeemed_at",
            "validated_at",
            "notes",
        )
        read_only_fields = fields

    def get_referrer_name(self, obj):
        return f"{obj.referrer_customer.first_name} {obj.referrer_customer.last_name}".strip()

    def get_referred_name(self, obj):
        return f"{obj.referred_customer.first_name} {obj.referred_customer.last_name}".strip()
