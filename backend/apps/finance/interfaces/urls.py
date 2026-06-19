from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FinancialTransactionViewSet, SalesInvoicePdfView, SalesInvoiceViewSet

router = DefaultRouter()
router.register("transactions", FinancialTransactionViewSet)
router.register("invoices", SalesInvoiceViewSet)

urlpatterns = [
    path("invoices/<uuid:pk>/pdf/", SalesInvoicePdfView.as_view(), name="invoice-pdf"),
] + router.urls
