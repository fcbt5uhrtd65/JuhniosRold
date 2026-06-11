from dataclasses import dataclass

from django.db import transaction

from apps.finance.application.invoicing import GenerateSalesInvoice

from ..services import OrderInventoryService
from ...domain.exceptions import PaymentIntegrityError
from ...domain.repositories import PaymentGateway
from ...infrastructure.models import Order, OrderStatusHistory, Payment, PaymentWebhookEvent
from ...infrastructure.payment_gateways import WompiPaymentGateway


@dataclass(frozen=True)
class WebhookResult:
    processed: bool
    duplicate: bool = False
    ignored: bool = False


class ConfirmWompiPayment:
    STATUS_MAP = {
        "PENDING": Payment.Status.PENDING,
        "APPROVED": Payment.Status.APPROVED,
        "DECLINED": Payment.Status.DECLINED,
        "ERROR": Payment.Status.ERROR,
        "VOIDED": Payment.Status.VOIDED,
        "EXPIRED": Payment.Status.EXPIRED,
        "CANCELLED": Payment.Status.VOIDED,
    }

    def __init__(self, gateway: PaymentGateway | None = None):
        self.gateway = gateway or WompiPaymentGateway()

    @transaction.atomic
    def execute(self, *, payload: dict, header_checksum: str = "") -> WebhookResult:
        self.gateway.validate_event(payload, header_checksum)

        signature = payload["signature"]
        checksum = str(header_checksum or signature["checksum"]).lower()
        transaction_data = (payload.get("data") or {}).get("transaction") or {}
        event, created = PaymentWebhookEvent.objects.select_for_update().get_or_create(
            checksum=checksum,
            defaults={
                "event_type": payload.get("event", ""),
                "environment": payload.get("environment", ""),
                "event_timestamp": payload.get("timestamp", 0),
                "transaction_id": transaction_data.get("id", ""),
                "reference": transaction_data.get("reference", ""),
                "transaction_status": transaction_data.get("status", ""),
            },
        )
        was_duplicate = not created
        if was_duplicate and event.processed:
            return WebhookResult(processed=event.processed, duplicate=True)

        if payload.get("event") != "transaction.updated":
            event.processed = True
            event.save(update_fields=("processed", "updated_at"))
            return WebhookResult(processed=True, duplicate=was_duplicate, ignored=True)

        reference = transaction_data.get("reference")
        payment = (
            Payment.objects.select_for_update()
            .select_related("order")
            .filter(reference=reference)
            .first()
        )
        if payment is None:
            event.processing_error = "No existe un pago local para la referencia recibida."
            event.save(update_fields=("processing_error", "updated_at"))
            return WebhookResult(
                processed=False,
                duplicate=was_duplicate,
                ignored=True,
            )

        order = (
            Order.objects.select_for_update()
            .prefetch_related("items__variant")
            .get(pk=payment.order_id)
        )
        self._validate_transaction(payment, transaction_data)

        incoming_status = self.STATUS_MAP.get(transaction_data.get("status"))
        if incoming_status is None:
            event.processing_error = "Estado de transacción no soportado."
            event.save(update_fields=("processing_error", "updated_at"))
            return WebhookResult(
                processed=False,
                duplicate=was_duplicate,
                ignored=True,
            )

        if payment.status == Payment.Status.APPROVED and incoming_status != Payment.Status.APPROVED:
            event.processed = True
            event.processing_error = "Se ignoró una regresión posterior a APPROVED."
            event.save(update_fields=("processed", "processing_error", "updated_at"))
            return WebhookResult(
                processed=True,
                duplicate=was_duplicate,
                ignored=True,
            )

        payment.status = incoming_status
        payment.payment_method = transaction_data.get("payment_method_type", "")
        payment.provider_transaction_id = transaction_data.get("id")
        payment.save(
            update_fields=(
                "status",
                "payment_method",
                "provider_transaction_id",
                "updated_at",
            )
        )

        if incoming_status == Payment.Status.APPROVED:
            OrderInventoryService.consume(order)
            self._change_order_status(order, Order.Status.PAID, "Pago aprobado por Wompi.")
            GenerateSalesInvoice().execute(order=order, payment=payment)
            order_id = str(order.id)
            transaction.on_commit(
                lambda: self._send_payment_confirmation(order_id)
            )
        elif incoming_status == Payment.Status.PENDING:
            self._change_order_status(
                order,
                Order.Status.PAYMENT_PENDING,
                "Pago pendiente en Wompi.",
            )
        else:
            newer_attempt_exists = order.payments.filter(
                created_at__gt=payment.created_at,
                status__in=(Payment.Status.PENDING, Payment.Status.APPROVED),
            ).exists()
            if not newer_attempt_exists:
                OrderInventoryService.release(order)
                self._change_order_status(
                    order,
                    Order.Status.FAILED,
                    f"Pago finalizado por Wompi con estado {incoming_status}.",
                )

        order.save(
            update_fields=(
                "status",
                "inventory_consumed_at",
                "inventory_released_at",
                "updated_at",
            )
        )
        event.processed = True
        event.processing_error = ""
        event.save(update_fields=("processed", "processing_error", "updated_at"))
        return WebhookResult(processed=True, duplicate=was_duplicate)

    @staticmethod
    def _validate_transaction(payment, transaction_data):
        if transaction_data.get("reference") != payment.reference:
            raise PaymentIntegrityError("La referencia del pago no coincide.")
        if transaction_data.get("amount_in_cents") != payment.amount_in_cents:
            raise PaymentIntegrityError("El monto del pago no coincide.")
        if transaction_data.get("currency") != payment.currency:
            raise PaymentIntegrityError("La moneda del pago no coincide.")
        transaction_id = transaction_data.get("id")
        if not transaction_id:
            raise PaymentIntegrityError("El evento no contiene el ID de transacción.")
        if (
            payment.provider_transaction_id
            and payment.provider_transaction_id != transaction_id
        ):
            raise PaymentIntegrityError("El ID de transacción no coincide con el pago.")
        if Payment.objects.exclude(pk=payment.pk).filter(
            provider_transaction_id=transaction_id
        ).exists():
            raise PaymentIntegrityError("La transacción ya está asociada a otro pago.")

    @staticmethod
    def _change_order_status(order, new_status, notes):
        if order.status == new_status:
            return
        order.status = new_status
        OrderStatusHistory.objects.create(order=order, status=new_status, notes=notes)

    @staticmethod
    def _send_payment_confirmation(order_id):
        from ...infrastructure.tasks import send_order_payment_confirmation

        send_order_payment_confirmation.delay(order_id)
