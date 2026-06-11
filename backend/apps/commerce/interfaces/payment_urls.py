from django.urls import path

from .webhooks import (
    InitiatePaymentView,
    InitiateWompiPaymentView,
    ResolveMockPaymentView,
    WompiPaymentStatusView,
    WompiWebhookView,
)

app_name = "commerce_payments"

urlpatterns = [
    path("iniciar/", InitiatePaymentView.as_view(), name="payment-start"),
    path(
        "mock/<uuid:payment_id>/resolver/",
        ResolveMockPaymentView.as_view(),
        name="mock-resolve",
    ),
    path("wompi/iniciar/", InitiateWompiPaymentView.as_view(), name="wompi-start"),
    path("wompi/webhook/", WompiWebhookView.as_view(), name="wompi-webhook"),
    path(
        "estado/<uuid:order_id>/",
        WompiPaymentStatusView.as_view(),
        name="payment-status",
    ),
    path(
        "wompi/estado/<uuid:order_id>/",
        WompiPaymentStatusView.as_view(),
        name="wompi-status",
    ),
]
