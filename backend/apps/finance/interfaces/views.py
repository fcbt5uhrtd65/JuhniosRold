from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.pagination import StandardPagination
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.invoice_pdf import render_invoice_pdf
from ..infrastructure.models import FinancialTransaction, PaymentAccount, SalesInvoice
from ..infrastructure.serializers import (
    FinancialTransactionSerializer,
    PaymentAccountSerializer,
    SalesInvoiceSerializer,
)
from .payment_account_filters import PaymentAccountFilter
from .permissions import IsAccounting


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


class PaymentAccountPagination(StandardPagination):
    page_size = 10

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        response.data["page_size"] = self.get_page_size(self.request) or self.page_size
        response.data["total_pages"] = self.page.paginator.num_pages
        return response


class PaymentAccountViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Cuentas de cobro: listar, crear, consultar y eliminar (soft). Sin edición."""

    queryset = PaymentAccount.objects.select_related("created_by")
    serializer_class = PaymentAccountSerializer
    permission_classes = (IsAccounting,)
    pagination_class = PaymentAccountPagination
    filterset_class = PaymentAccountFilter
    ordering = ("-number",)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # El consecutivo es único: ante una carrera entre dos creaciones se
        # reintenta con el siguiente número disponible.
        for _ in range(5):
            try:
                with transaction.atomic():
                    instance = serializer.save(
                        created_by=request.user,
                        number=PaymentAccount.next_number(),
                    )
                break
            except IntegrityError:
                continue
        else:
            return Response(
                {"detail": "No se pudo asignar el consecutivo. Intenta de nuevo."},
                status=409,
            )
        return Response(self.get_serializer(instance).data, status=201)

    def perform_destroy(self, instance):
        instance.soft_delete()

    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request):
        return Response({"next_number": PaymentAccount.next_number()})
