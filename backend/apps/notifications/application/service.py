from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction

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

        if send_email and not settings.DEBUG:
            notif_id = str(notif.id)

            def _enqueue():
                try:
                    from apps.notifications.tasks import send_notification_email
                    send_notification_email.apply_async(
                        args=(notif_id,),
                        ignore_result=True,
                        retry=False,
                    )
                except Exception:
                    logger.exception(
                        "No fue posible encolar email para notificación %s.", notif_id
                    )

            transaction.on_commit(_enqueue)

        return notif
