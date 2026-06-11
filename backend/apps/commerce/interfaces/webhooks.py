from dataclasses import asdict

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from ..application.use_cases import (
    ConfirmWompiPayment,
    InitiateMockPayment,
    InitiateWompiPayment,
    ResolveMockPayment,
)
from ..infrastructure.models import Order, Payment
from ..infrastructure.serializers import (
    InitiateWompiPaymentSerializer,
    PaymentStartResponseSerializer,
    ResolveMockPaymentSerializer,
    WompiPaymentStatusSerializer,
    WompiWebhookSerializer,
)
from .permissions import IsOrderOwnerOrStaff


def _get_owned_order(view, request, order_id):
    order = get_object_or_404(
        Order.objects.select_related("customer"),
        pk=order_id,
    )
    view.check_object_permissions(request, order)
    return order


def _wompi_start_data(checkout):
    payment = Payment.objects.get(reference=checkout.reference)
    return {
        **asdict(checkout),
        "provider": "wompi",
        "payment_id": payment.id,
        "requires_redirect": True,
    }


class InitiatePaymentView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsOrderOwnerOrStaff)

    def post(self, request):
        serializer = InitiateWompiPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = _get_owned_order(self, request, serializer.validated_data["order_id"])

        if settings.PAYMENT_PROVIDER == "mock":
            payment = InitiateMockPayment().execute(
                order_id=order.id,
                actor=request.user,
            )
            data = {
                "provider": "mock",
                "payment_id": payment.id,
                "requires_redirect": False,
                "checkout_url": "",
                "reference": payment.reference,
                "amount_in_cents": payment.amount_in_cents,
                "currency": payment.currency,
                "public_key": "",
                "integrity_signature": "",
                "redirect_url": "",
            }
        else:
            checkout = InitiateWompiPayment().execute(
                order_id=order.id,
                actor=request.user,
            )
            data = _wompi_start_data(checkout)
        return Response(PaymentStartResponseSerializer(data).data)


class InitiateWompiPaymentView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsOrderOwnerOrStaff)

    def post(self, request):
        serializer = InitiateWompiPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = _get_owned_order(self, request, serializer.validated_data["order_id"])
        checkout = InitiateWompiPayment().execute(
            order_id=order.id,
            actor=request.user,
        )
        return Response(PaymentStartResponseSerializer(_wompi_start_data(checkout)).data)


class ResolveMockPaymentView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsOrderOwnerOrStaff)

    def post(self, request, payment_id):
        serializer = ResolveMockPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = get_object_or_404(
            Payment.objects.select_related("order__customer"),
            pk=payment_id,
            provider=Payment.Provider.MOCK,
        )
        self.check_object_permissions(request, payment.order)
        payment = ResolveMockPayment().execute(
            payment_id=payment.id,
            approved=serializer.validated_data["outcome"] == "approved",
            actor=request.user,
        )
        payment.refresh_from_db()
        payment.order.refresh_from_db()
        invoice = getattr(payment, "invoice", None)
        return Response(
            {
                "order_id": payment.order_id,
                "payment_status": payment.status,
                "order_status": payment.order.status,
                "invoice_number": invoice.number if invoice else "",
            }
        )


class WompiWebhookView(APIView):
    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = WompiWebhookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = ConfirmWompiPayment().execute(
            payload=serializer.validated_data,
            header_checksum=request.headers.get("X-Event-Checksum", ""),
        )
        return Response(
            {
                "processed": result.processed,
                "duplicate": result.duplicate,
                "ignored": result.ignored,
            }
        )


class WompiPaymentStatusView(APIView):
    permission_classes = (permissions.IsAuthenticated, IsOrderOwnerOrStaff)

    def get(self, request, order_id):
        order = get_object_or_404(
            Order.objects.select_related("customer").prefetch_related("payments"),
            pk=order_id,
        )
        self.check_object_permissions(request, order)
        payment = order.payments.order_by("-created_at").first()
        invoice = getattr(payment, "invoice", None) if payment else None
        data = {
            "order_id": order.id,
            "order_status": order.status,
            "payment_status": payment.status if payment else None,
            "provider": payment.provider.lower() if payment else "",
            "payment_method": payment.payment_method if payment else "",
            "transaction_id": payment.provider_transaction_id if payment else "",
            "invoice_number": invoice.number if invoice else "",
        }
        return Response(WompiPaymentStatusSerializer(data).data)
