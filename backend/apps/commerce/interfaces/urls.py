from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ActiveCartCheckoutView,
    ActiveCartItemCollectionView,
    ActiveCartItemDetailView,
    ActiveCartView,
    OrderViewSet,
    PaymentListView,
    WholesaleSettingsView,
)
from .webhooks import (
    InitiatePaymentView,
    InitiateWompiPaymentView,
    ResolveMockPaymentView,
    WompiPaymentStatusView,
    WompiWebhookView,
)

router = DefaultRouter()
router.register("orders", OrderViewSet)

urlpatterns = router.urls + [
    path("cart/", ActiveCartView.as_view(), name="active-cart"),
    path("cart/items/", ActiveCartItemCollectionView.as_view(), name="cart-items"),
    path(
        "cart/items/<uuid:item_id>/",
        ActiveCartItemDetailView.as_view(),
        name="cart-item-detail",
    ),
    path("cart/checkout/", ActiveCartCheckoutView.as_view(), name="cart-checkout"),
    path("wholesale-settings/", WholesaleSettingsView.as_view(), name="wholesale-settings"),
    path("payments/", PaymentListView.as_view(), name="payments-list"),
    path("payments/start/", InitiatePaymentView.as_view(), name="payment-start"),
    path(
        "payments/mock/<uuid:payment_id>/resolve/",
        ResolveMockPaymentView.as_view(),
        name="mock-payment-resolve",
    ),
    path(
        "payments/wompi/start/",
        InitiateWompiPaymentView.as_view(),
        name="wompi-payment-start",
    ),
    path(
        "payments/wompi/webhook/",
        WompiWebhookView.as_view(),
        name="wompi-payment-webhook",
    ),
    path(
        "payments/status/<uuid:order_id>/",
        WompiPaymentStatusView.as_view(),
        name="payment-status",
    ),
    path(
        "payments/wompi/status/<uuid:order_id>/",
        WompiPaymentStatusView.as_view(),
        name="wompi-payment-status",
    ),
]
