from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.invoice_pdf import render_invoice_pdf
from ..infrastructure.models import FinancialTransaction, SalesInvoice
from ..infrastructure.serializers import (
    FinancialTransactionSerializer,
    SalesInvoiceSerializer,
)
from ..infrastructure.tasks import submit_invoice_to_dian


class FinancialTransactionViewSet(SoftDeleteModelViewSet):
    queryset = FinancialTransaction.objects.select_related("created_by")
    serializer_class = FinancialTransactionSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "finance.management"
    filterset_fields = ("transaction_type", "category", "occurred_on")
    search_fields = ("category", "description", "reference")
    ordering_fields = ("occurred_on", "amount", "created_at")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SalesInvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SalesInvoice.objects.select_related(
        "order__customer",
        "payment",
    ).prefetch_related("lines")
    serializer_class = SalesInvoiceSerializer
    filterset_fields = ("order",)
    search_fields = ("number", "order__number", "customer_document", "customer_email")
    ordering_fields = ("issued_at", "total")

    def get_queryset(self):
        queryset = super().get_queryset()
        has_access = getattr(self.request.user, "has_component_access", lambda *_args, **_kwargs: False)
        if has_access("finance.management", "view"):
            return queryset
        return queryset.filter(order__customer__user=self.request.user)


class SalesInvoicePdfView(APIView):
    def get(self, request, pk):
        queryset = SalesInvoice.objects.select_related("order__customer", "payment").prefetch_related("lines")
        has_access = getattr(request.user, "has_component_access", lambda *_args, **_kwargs: False)
        if not has_access("finance.management", "view"):
            queryset = queryset.filter(order__customer__user=request.user)
        invoice = get_object_or_404(queryset, pk=pk)

        pdf_buffer = render_invoice_pdf(invoice)
        return FileResponse(
            pdf_buffer,
            as_attachment=False,
            filename=f"{invoice.number}.pdf",
            content_type="application/pdf",
        )


class SalesInvoiceRetryDianView(APIView):
    permission_classes = (HasComponentAccess,)
    required_component = "finance.management"
    required_component_action = "edit"

    def post(self, request, pk):
        invoice = get_object_or_404(SalesInvoice, pk=pk)
        if invoice.dian_status == SalesInvoice.DianStatus.VALIDATED:
            return Response(
                {"detail": "La factura ya fue validada por la DIAN."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.dian_status = SalesInvoice.DianStatus.PENDING
        invoice.dian_retry_count = 0
        invoice.dian_error_detail = ""
        invoice.save(
            update_fields=("dian_status", "dian_retry_count", "dian_error_detail", "updated_at")
        )
        submit_invoice_to_dian.delay(invoice.id)
        return Response(SalesInvoiceSerializer(invoice).data)
