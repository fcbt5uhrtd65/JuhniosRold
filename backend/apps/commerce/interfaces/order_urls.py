from django.urls import path

from .views import ActiveCartCheckoutView, OrderViewSet


app_name = "commerce_orders"

urlpatterns = [
    path("", ActiveCartCheckoutView.as_view(), name="order-create"),
    path(
        "<uuid:pk>/",
        OrderViewSet.as_view({"get": "retrieve"}),
        name="order-detail",
    ),
]
