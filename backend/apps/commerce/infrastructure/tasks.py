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
def send_order_placed_notification(order_id):
    order = Order.objects.select_related("customer").get(pk=order_id)
    try:
        from apps.notifications.application.service import NotificationService
        from apps.notifications.infrastructure.models import Notification

        order_ref = order.number or str(order.id)[:8].upper()
        NotificationService.send(
            customer=order.customer,
            type=Notification.Type.INFO,
            title="Pedido recibido",
            message=(
                f"Hemos recibido tu pedido #{order_ref} por "
                f"${order.total:,.0f} COP. Pronto confirmaremos tu pago."
            ),
            action_url="/perfil?s=pedidos",
            send_email=not settings.DEBUG,
        )
    except Exception:
        logger.exception("Error al crear notificación de pedido recibido %s.", order_id)


@shared_task(ignore_result=True)
def send_order_payment_confirmation(order_id):
    order = Order.objects.select_related("customer").get(pk=order_id)
    title = f"Pago confirmado — pedido {order.number}"
    message = (
        f"Hola {order.customer.first_name}, el pago de tu pedido {order.number} "
        "fue confirmado. Ya estamos preparando tu compra."
    )
    try:
        from apps.notifications.application.service import NotificationService
        from apps.notifications.infrastructure.models import Notification
        order_ref = order.number or str(order.id)[:8].upper()
        NotificationService.send(
            customer=order.customer,
            type=Notification.Type.ORDER_CONFIRMED,
            title="Pago confirmado",
            message=f"Tu pedido #{order_ref} fue pagado correctamente. Ya lo estamos preparando.",
            action_url="/perfil?s=pedidos",
            send_email=False,
        )
    except Exception:
        logger.exception("Error al crear notificación in-app para pedido %s.", order_id)

    if settings.DEBUG:
        logger.info("DEBUG activo: email de confirmación de pago %s omitido.", order_id)
        return

    try:
        send_mail(
            subject=title,
            message=f"{message}\n\nGracias por tu compra en Juhnios Rold.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.customer.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception("Error enviando email de confirmación de pago %s.", order_id)


def enqueue_order_placed_notification(order_id):
    try:
        send_order_placed_notification.apply_async(
            args=(str(order_id),),
            retry=False,
            ignore_result=True,
        )
    except Exception:
        logger.exception("No fue posible encolar notificación de pedido %s.", order_id)


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
                .select_related("order")
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
