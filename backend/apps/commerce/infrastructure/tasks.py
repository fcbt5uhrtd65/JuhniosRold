import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from ..application.services import OrderInventoryService
from .models import Order, OrderStatusHistory, Payment

logger = logging.getLogger(__name__)


@shared_task(ignore_result=True)
def send_order_payment_confirmation(order_id):
    order = Order.objects.select_related("customer").get(pk=order_id)
    send_mail(
        subject=f"Pago confirmado para tu pedido {order.number}",
        message=(
            f"Hola {order.customer.first_name},\n\n"
            f"El proveedor de pagos confirmó el pedido {order.number}. "
            "Ya estamos preparando tu compra."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[order.customer.email],
        fail_silently=False,
    )


def enqueue_order_payment_confirmation(order_id):
    try:
        send_order_payment_confirmation.apply_async(
            args=(order_id,),
            retry=False,
            ignore_result=True,
        )
    except Exception:
        logger.exception(
            "No fue posible encolar la confirmación del pedido %s.",
            order_id,
        )


@shared_task
def release_expired_wompi_reservations():
    cutoff = timezone.now() - timedelta(
        minutes=settings.WOMPI_CHECKOUT_EXPIRATION_MINUTES + 5
    )
    payment_ids = list(
        Payment.objects.filter(
            status=Payment.Status.PENDING,
            created_at__lt=cutoff,
            provider_transaction_id__isnull=True,
        ).values_list("id", flat=True)
    )
    released = 0

    for payment_id in payment_ids:
        with transaction.atomic():
            payment = (
                Payment.objects.select_for_update()
                .select_related("order__fulfillment_location")
                .get(pk=payment_id)
            )
            if payment.status != Payment.Status.PENDING:
                continue

            order = (
                Order.objects.select_for_update()
                .prefetch_related("items__variant")
                .get(pk=payment.order_id)
            )
            OrderInventoryService.release(order)
            payment.status = Payment.Status.EXPIRED
            payment.save(update_fields=("status", "updated_at"))
            if order.status == Order.Status.PAYMENT_PENDING:
                order.status = Order.Status.FAILED
                OrderStatusHistory.objects.create(
                    order=order,
                    status=order.status,
                    notes="Checkout de Wompi expirado sin confirmación de pago.",
                )
            order.save(
                update_fields=("status", "inventory_released_at", "updated_at")
            )
            released += 1

    return released
