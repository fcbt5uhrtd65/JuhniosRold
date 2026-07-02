from django.contrib import admin

from .infrastructure.models import ReferralCode, ReferralRedemption


@admin.register(ReferralCode)
class ReferralCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "customer", "created_at")
    search_fields = ("code", "customer__first_name", "customer__last_name", "customer__email")


@admin.register(ReferralRedemption)
class ReferralRedemptionAdmin(admin.ModelAdmin):
    list_display = ("referral_code", "referrer_customer", "referred_customer", "status", "redeemed_at")
    list_filter = ("status",)
    search_fields = ("referrer_customer__first_name", "referred_customer__first_name", "referral_code__code")
