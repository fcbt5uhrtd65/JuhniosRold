import logging

from celery import shared_task

from apps.identity.infrastructure.tasks import _send_email
from apps.notifications.infrastructure.models import Notification

logger = logging.getLogger(__name__)


@shared_task(ignore_result=True)
def send_notification_email(notification_id: str):
    try:
        notif = Notification.objects.select_related("customer", "order").get(pk=notification_id)
    except Notification.DoesNotExist:
        logger.warning("Notificación %s no encontrada para enviar email.", notification_id)
        return

    attachments = []
    message = notif.message
    if notif.type == Notification.Type.ORDER_CONFIRMED and notif.order_id:
        attachments = _build_invoice_attachment(notif.order)
        if attachments:
            first_name = (notif.customer.first_name or "").strip()
            greeting = f"Hola {first_name}," if first_name else "Hola,"
            message = (
                f"{greeting}\n\n"
                "¡Gracias por tu compra en Juhnios Rold! Adjunto a este correo "
                "encontrarás la factura de tu pedido.\n\n"
                f"{message}"
            )

    _send_email(
        subject=f"{notif.title} - Juhnios Rold",
        message=message,
        recipient=notif.customer.email,
        attachments=attachments,
    )


def _build_invoice_attachment(order):
    from apps.finance.infrastructure.invoice_pdf import render_invoice_pdf
    from apps.finance.infrastructure.models import SalesInvoice

    invoice = SalesInvoice.objects.filter(order=order).select_related(
        "order__customer", "payment"
    ).prefetch_related("lines").first()
    if invoice is None:
        logger.warning("No se encontró factura para el pedido %s al enviar el email de pago confirmado.", order.id)
        return []

    try:
        pdf_buffer = render_invoice_pdf(invoice)
    except Exception:
        logger.exception("No fue posible generar el PDF de la factura %s para el email.", invoice.id)
        return []

    return [
        {
            "filename": f"{invoice.number}.pdf",
            "content": pdf_buffer.getvalue(),
            "mimetype": "application/pdf",
        }
    ]
