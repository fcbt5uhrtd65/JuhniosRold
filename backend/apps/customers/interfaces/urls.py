from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CustomerContactViewSet, CustomerSegmentViewSet, CustomerViewSet, MyCustomerProfileView

router = DefaultRouter()
router.register("", CustomerViewSet, basename="customer")
router.register("contacts", CustomerContactViewSet)
router.register("segments", CustomerSegmentViewSet)

urlpatterns = [
    path("me/", MyCustomerProfileView.as_view(), name="customer-me"),
    *router.urls,
]
