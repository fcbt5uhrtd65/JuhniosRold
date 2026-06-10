from rest_framework.routers import DefaultRouter

from .views import FinancialTransactionViewSet

router = DefaultRouter()
router.register("transactions", FinancialTransactionViewSet)

urlpatterns = router.urls
