import logging

from celery import shared_task
from django.contrib.auth import get_user_model

from apps.identity.infrastructure.tasks import _send_email

from ..application.use_cases import ActualizarTrackingUseCase
from .models import EnvioModel

logger = logging.getLogger(__name__)


@shared_task
def update_external_tracking():
    shipment_ids = list(
        EnvioModel.objects.exclude(proveedor_externo="manual")
        .exclude(
            estado_envio__in=(
                EnvioModel.Estado.ENTREGADO,
                EnvioModel.Estado.DEVUELTO,
                EnvioModel.Estado.CANCELADO,
            )
        )
        .exclude(numero_guia="")
        .values_list("id", flat=True)
    )
    updated = 0
    for shipment_id in shipment_ids:
        try:
            ActualizarTrackingUseCase().execute(envio_id=shipment_id)
            updated += 1
        except Exception:
            logger.exception("No fue posible actualizar el envío %s.", shipment_id)
    return updated


@shared_task(ignore_result=True)
def send_shipping_status_notification(envio_id):
    envio = EnvioModel.objects.select_related("pedido__customer").get(pk=envio_id)
    customer = envio.pedido.customer
    if not customer.email:
        return
    try:
        _send_email(
            subject=f"Actualización de tu pedido {envio.pedido.number}",
            message=(
                f"Hola {customer.first_name},\n\n"
                f"Tu envío ahora está en estado: {envio.get_estado_envio_display()}.\n"
                f"Número de guía: {envio.numero_guia or 'pendiente'}\n"
                f"Consulta el seguimiento desde tu cuenta."
            ),
            recipient=customer.email,
        )
    except Exception:
        logger.exception(
            "No fue posible enviar el correo de estado de envío %s.", envio_id
        )


@shared_task(ignore_result=True)
def alert_shipping_incident(envio_id):
    envio = EnvioModel.objects.select_related("pedido").get(pk=envio_id)
    recipients = list(
        get_user_model().objects.filter(
            role__is_superuser=True,
            is_active=True,
        ).exclude(email="").values_list("email", flat=True)
    )
    if not recipients:
        return
    subject = f"Novedad logística en {envio.pedido.number}"
    message = (
        f"El envío {envio.id} del pedido {envio.pedido.number} "
        "presenta una novedad y requiere revisión."
    )
    for recipient in recipients:
        try:
            _send_email(subject=subject, message=message, recipient=recipient)
        except Exception:
            logger.exception(
                "No fue posible enviar la alerta de envío %s a %s.",
                envio_id,
                recipient,
            )


def enqueue_shipping_notifications(envio_id):
    try:
        send_shipping_status_notification.apply_async(
            args=(envio_id,),
            retry=False,
            ignore_result=True,
        )
        envio = EnvioModel.objects.only("estado_envio").get(pk=envio_id)
        if envio.estado_envio == EnvioModel.Estado.NOVEDAD:
            alert_shipping_incident.apply_async(
                args=(envio_id,),
                retry=False,
                ignore_result=True,
            )
    except Exception:
        logger.exception(
            "No fue posible encolar notificaciones del envío %s.",
            envio_id,
        )
