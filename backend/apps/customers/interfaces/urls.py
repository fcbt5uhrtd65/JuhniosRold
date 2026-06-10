from rest_framework.routers import DefaultRouter

from .views import CustomerContactViewSet, CustomerSegmentViewSet, CustomerViewSet

router = DefaultRouter()
router.register("", CustomerViewSet, basename="customer")
router.register("contacts", CustomerContactViewSet)
router.register("segments", CustomerSegmentViewSet)

urlpatterns = router.urls
