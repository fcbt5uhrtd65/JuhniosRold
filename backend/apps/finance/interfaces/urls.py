from rest_framework.routers import DefaultRouter

from .views import FinancialTransactionViewSet, SalesInvoiceViewSet

router = DefaultRouter()
router.register("transactions", FinancialTransactionViewSet)
router.register("invoices", SalesInvoiceViewSet)

urlpatterns = router.urls
