import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
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


def enqueue_order_placed_notification(order_id):
    try:
        send_order_placed_notification.apply_async(
            args=(str(order_id),),
            retry=False,
            ignore_result=True,
        )
    except Exception:
        logger.exception("No fue posible encolar notificación de pedido %s.", order_id)


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


# ── Recuperación de compras: correo 1 hora después de un pedido fallido ──
RECOVERY_NOTIFICATION_TITLE = "¿Quieres terminar tu compra?"
RECOVERY_DELAY = timedelta(hours=1)
# Solo pedidos que fallaron en las últimas 48 h, para no escribir a clientes
# con pedidos viejos la primera vez que se activa la función.
RECOVERY_MAX_AGE = timedelta(hours=48)


@shared_task(ignore_result=True)
def send_failed_order_recovery_emails():
    from apps.notifications.application.service import NotificationService
    from apps.notifications.infrastructure.models import Notification

    now = timezone.now()
    failed_order_ids = (
        OrderStatusHistory.objects.filter(
            status=Order.Status.FAILED,
            created_at__lte=now - RECOVERY_DELAY,
            created_at__gte=now - RECOVERY_MAX_AGE,
            order__status=Order.Status.FAILED,
        )
        .values_list("order_id", flat=True)
        .distinct()
    )

    sent = 0
    for order in Order.objects.filter(pk__in=list(failed_order_ids)).select_related("customer"):
        if not order.customer or not getattr(order.customer, "email", ""):
            continue
        # Una sola vez por pedido.
        if Notification.objects.filter(order=order, title=RECOVERY_NOTIFICATION_TITLE).exists():
            continue
        # Si el cliente ya compró después, no lo molestamos.
        if Order.objects.filter(
            customer=order.customer,
            created_at__gt=order.created_at,
            status__in=(
                Order.Status.PAID,
                Order.Status.PROCESSING,
                Order.Status.PACKED,
                Order.Status.SHIPPED,
                Order.Status.DELIVERED,
            ),
        ).exists():
            continue
        try:
            order_ref = order.number or str(order.id)[:8].upper()
            NotificationService.send(
                customer=order.customer,
                type=Notification.Type.PROMO,
                title=RECOVERY_NOTIFICATION_TITLE,
                message=(
                    f"Tu pedido #{order_ref} quedó sin completar. Tus productos te están "
                    "esperando: entra a Mis pedidos y dale a «Terminar mi compra»."
                ),
                action_url="/perfil?s=pedidos",
                send_email=True,
                order=order,
            )
            sent += 1
        except Exception:
            logger.exception("No fue posible enviar el correo de recuperación del pedido %s.", order.id)

    return sent
