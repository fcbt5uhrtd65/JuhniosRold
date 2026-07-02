from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    EnvioViewSet,
    PedidoTrackingView,
    ShippingQuoteView,
    ShippingSettingsView,
    ShippingZoneViewSet,
    TransportadoraViewSet,
)
from .webhooks import ShippingWebhookView

router = DefaultRouter()
router.register("envios", EnvioViewSet, basename="envio")
router.register("transportadoras", TransportadoraViewSet, basename="transportadora")
router.register("shipping-zones", ShippingZoneViewSet, basename="shipping-zone")

urlpatterns = router.urls + [
    path(
        "pedidos/<uuid:pedido_id>/tracking/",
        PedidoTrackingView.as_view(),
        name="pedido-tracking",
    ),
    path("webhook/", ShippingWebhookView.as_view(), name="shipping-webhook"),
    path("shipping-settings/", ShippingSettingsView.as_view(), name="shipping-settings"),
    path("shipping-quote/", ShippingQuoteView.as_view(), name="shipping-quote"),
]
