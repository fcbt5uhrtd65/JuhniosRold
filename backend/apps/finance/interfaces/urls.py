from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FinancialTransactionViewSet, PaymentAccountViewSet, SalesInvoicePdfView, SalesInvoiceViewSet

router = DefaultRouter()
router.register("transactions", FinancialTransactionViewSet)
router.register("invoices", SalesInvoiceViewSet)
router.register("payment-accounts", PaymentAccountViewSet, basename="payment-account")

urlpatterns = [
    path("invoices/<uuid:pk>/pdf/", SalesInvoicePdfView.as_view(), name="invoice-pdf"),
] + router.urls
