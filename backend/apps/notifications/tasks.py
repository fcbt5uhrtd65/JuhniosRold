import logging

from celery import shared_task

from apps.identity.infrastructure.tasks import _send_email

logger = logging.getLogger(__name__)


@shared_task(ignore_result=True)
def send_notification_email(notification_id: str):
    from apps.notifications.infrastructure.models import Notification

    try:
        notif = Notification.objects.select_related("customer").get(pk=notification_id)
    except Notification.DoesNotExist:
        logger.warning("Notificación %s no encontrada para enviar email.", notification_id)
        return

    _send_email(
        subject=f"{notif.title} - Juhnios Rold",
        message=notif.message,
        recipient=notif.customer.email,
    )
