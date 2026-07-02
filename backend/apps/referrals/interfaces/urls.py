from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MyReferralCodeView, ReferralRedemptionViewSet

router = DefaultRouter()
router.register("redemptions", ReferralRedemptionViewSet, basename="referral-redemption")

urlpatterns = [
    path("me/", MyReferralCodeView.as_view(), name="my-referral-code"),
    *router.urls,
]
