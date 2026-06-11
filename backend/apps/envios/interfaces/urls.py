from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import EnvioViewSet, PedidoTrackingView, TransportadoraViewSet
from .webhooks import ShippingWebhookView

router = DefaultRouter()
router.register("envios", EnvioViewSet, basename="envio")
router.register("transportadoras", TransportadoraViewSet, basename="transportadora")

urlpatterns = router.urls + [
    path(
        "pedidos/<uuid:pedido_id>/tracking/",
        PedidoTrackingView.as_view(),
        name="pedido-tracking",
    ),
    path("webhook/", ShippingWebhookView.as_view(), name="shipping-webhook"),
]
