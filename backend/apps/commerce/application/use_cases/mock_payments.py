import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction

from shared.domain.exceptions import BusinessRuleViolation

from apps.finance.application.invoicing import GenerateSalesInvoice

from ..services import OrderInventoryService
from .cart import ActiveCartService
from ...infrastructure.models import Order, OrderStatusHistory, Payment


class InitiateMockPayment:
    @transaction.atomic
    def execute(self, *, order_id, actor=None):
        if settings.PAYMENT_PROVIDER != "mock":
            raise BusinessRuleViolation("El proveedor de pagos simulado no está habilitado.")
        order = (
            Order.objects.select_for_update()
            .select_related("customer")
            .prefetch_related("items__variant")
            .get(pk=order_id)
        )
        if order.status in (Order.Status.PAID, Order.Status.DELIVERED):
            raise BusinessRuleViolation("El pedido ya fue pagado.")
        if order.status == Order.Status.CANCELLED:
            raise BusinessRuleViolation("No se puede pagar un pedido cancelado.")

        OrderInventoryService.reserve(order)
        payment = (
            order.payments.filter(
                provider=Payment.Provider.MOCK,
                status=Payment.Status.PENDING,
            )
            .order_by("-created_at")
            .first()
        )
        if not payment:
            payment = Payment.objects.create(
                order=order,
                provider=Payment.Provider.MOCK,
                reference=f"MOCK-{order.number}-{uuid.uuid4().hex[:8].upper()}",
                amount_in_cents=int(
                    (order.total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                ),
                currency="COP",
                payment_method="MOCK",
            )

        if order.status != Order.Status.PAYMENT_PENDING:
            order.status = Order.Status.PAYMENT_PENDING
            OrderStatusHistory.objects.create(
                order=order,
                status=order.status,
                notes="Pago simulado iniciado.",
                changed_by=actor,
            )
        order.payment_reference = payment.reference
        order.save(
            update_fields=(
                "status",
                "payment_reference",
                "inventory_reserved_at",
                "inventory_released_at",
                "updated_at",
            )
        )
        return payment


class ResolveMockPayment:
    @transaction.atomic
    def execute(self, *, payment_id, approved, actor=None):
        if settings.PAYMENT_PROVIDER != "mock":
            raise BusinessRuleViolation("El proveedor de pagos simulado no está habilitado.")
        payment = (
            Payment.objects.select_for_update()
            .select_related("order__customer")
            .get(pk=payment_id, provider=Payment.Provider.MOCK)
        )
        order = (
            Order.objects.select_for_update()
            .prefetch_related("items__variant")
            .get(pk=payment.order_id)
        )

        if payment.status == Payment.Status.APPROVED:
            return payment
        if payment.status != Payment.Status.PENDING:
            raise BusinessRuleViolation("El pago simulado ya fue resuelto.")

        payment.provider_transaction_id = f"mock-{uuid.uuid4()}"
        if approved:
            payment.status = Payment.Status.APPROVED
            OrderInventoryService.consume(order, actor=actor)
            ActiveCartService().remove_restored_order_items(order=order)
            order.status = Order.Status.PAID
            notes = "Pago aprobado por el proveedor simulado."
        else:
            payment.status = Payment.Status.DECLINED
            OrderInventoryService.release(order)
            ActiveCartService().restore_order_items(order=order)
            order.status = Order.Status.FAILED
            notes = "Pago rechazado por el proveedor simulado."

        payment.save(
            update_fields=("status", "provider_transaction_id", "updated_at")
        )
        order.save(
            update_fields=(
                "status",
                "inventory_consumed_at",
                "inventory_released_at",
                "updated_at",
            )
        )
        OrderStatusHistory.objects.create(
            order=order,
            status=order.status,
            notes=notes,
            changed_by=actor,
        )
        if approved:
            GenerateSalesInvoice().execute(order=order, payment=payment, actor=actor)
            order_id = str(order.id)
            transaction.on_commit(lambda: self._send_confirmation(order_id))
        return payment

    @staticmethod
    def _send_confirmation(order_id):
        from ...infrastructure.tasks import enqueue_order_payment_confirmation

        enqueue_order_payment_confirmation(order_id)
