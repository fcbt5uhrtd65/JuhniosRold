from __future__ import annotations

import logging

from apps.notifications.infrastructure.models import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    """Crea una notificación in-app y opcionalmente despacha un email."""

    @staticmethod
    def send(
        *,
        customer,
        type: str,
        title: str,
        message: str,
        action_url: str = "",
        send_email: bool = False,
    ) -> Notification:
        notif = Notification.objects.create(
            customer=customer,
            type=type,
            title=title,
            message=message,
            action_url=action_url,
        )

        if send_email:
            try:
                from apps.notifications.tasks import send_notification_email
                send_notification_email.apply_async(
                    args=(str(notif.id),),
                    ignore_result=True,
                    retry=False,
                )
            except Exception:
                logger.exception("No fue posible encolar email para notificación %s.", notif.id)

        return notif
