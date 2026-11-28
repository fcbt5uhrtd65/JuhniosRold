import logging
from decimal import Decimal

from celery import shared_task

from apps.identity.infrastructure.tasks import _send_email
from apps.notifications.infrastructure.models import Notification

logger = logging.getLogger(__name__)

# Debe coincidir con apps.commerce.infrastructure.tasks.RECOVERY_NOTIFICATION_TITLE
RECOVERY_NOTIFICATION_TITLE = "¿Quieres terminar tu compra?"


def _build_recovery_email(notif):
    from html import escape

    from django.conf import settings

    order = notif.order
    customer = notif.customer
    customer_name = escape(str(getattr(customer, "first_name", "") or "").strip() or "Hola")
    greeting = f"¡{customer_name}," if customer_name != "Hola" else "¡Hola,"
    order_ref = escape(order.number or str(order.id)[:8].upper())
    link = f"{settings.FRONTEND_URL.rstrip('/')}/perfil?s=pedidos"

    rows = []
    lines = []
    for item in order.items.all():
        qty = int(item.quantity) if item.quantity == int(item.quantity) else item.quantity
        name = escape(item.product_name)
        presentation = escape(item.presentation or "")
        price = f"${item.subtotal:,.0f}".replace(",", ".")
        lines.append(f"- {item.product_name} {item.presentation} x{qty}: {price}")
        rows.append(
            f"""
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #eee;font-size:14px;color:#222;">
                <strong>{name}</strong>
                <span style="color:#888;font-size:12px;">{(' · ' + presentation) if presentation else ''} · x{qty}</span>
              </td>
              <td style="padding:12px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;font-weight:bold;color:#0F6B3A;">{price}</td>
            </tr>"""
        )
    total = f"${order.total:,.0f}".replace(",", ".")

    plain = (
        f"{greeting} tus productos te están esperando!\n\n"
        f"Tu pedido #{order.number or str(order.id)[:8].upper()} no se completó, pero lo guardamos para ti:\n"
        + "\n".join(lines)
        + f"\n\nTotal: {total}\n\n"
        f"Termina tu compra aquí: {link}\n"
        "Entra a Mis pedidos y dale a «Terminar mi compra». Tus productos vuelven al carrito con un clic.\n\n"
        "Juhnios Rold S.A.S."
    )

    html = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Termina tu compra</title></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1A1C16;padding:36px 32px;text-align:center;">
    <p style="margin:0 0 8px;color:#C9A96A;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Juhnios Rold</p>
    <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;">{greeting}<br>tus productos te están esperando 🛍️</h1>
  </td></tr>
  <tr><td style="background:#E0103F;padding:12px 32px;text-align:center;color:#ffffff;font-size:14px;font-weight:bold;">
    Tu pedido #{order_ref} quedó a un paso de completarse
  </td></tr>
  <tr><td style="padding:28px 32px 8px;">
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#333;">
      Notamos que tu compra no se pudo finalizar. ¡No te preocupes! Guardamos tus productos
      para que la termines en un momento.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">{''.join(rows)}
      <tr>
        <td style="padding:14px 0 0;font-size:16px;font-weight:bold;color:#111;">Total</td>
        <td style="padding:14px 0 0;font-size:22px;font-weight:bold;text-align:right;color:#0F6B3A;">{total}</td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:28px 32px;text-align:center;">
    <a href="{escape(link)}" style="display:inline-block;background:#2D3A1F;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:16px 40px;border-radius:12px;">
      Terminar mi compra →
    </a>
    <p style="margin:14px 0 0;font-size:12px;color:#888;">
      Entra a <strong>Mis pedidos</strong> y dale a «Terminar mi compra»: tus productos vuelven al carrito con un clic.
    </p>
  </td></tr>
  <tr><td style="background:#1A1C16;padding:18px 32px;text-align:center;">
    <p style="margin:0;color:#ffffff;font-size:13px;">Juhnios Rold S.A.S.</p>
    <p style="margin:6px 0 0;color:#C9A96A;font-size:12px;">Cosmética capilar y corporal para el cuidado diario</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""
    return plain, html


@shared_task(ignore_result=True)
def send_notification_email(notification_id: str):
    try:
        notif = Notification.objects.select_related("customer", "order").get(pk=notification_id)
    except Notification.DoesNotExist:
        logger.warning("Notificación %s no encontrada para enviar email.", notification_id)
        return

    attachments = []

    subject = f"{notif.title} - Juhnios Rold S.A.S."
    plain_message = notif.message
    html_message = None

    if notif.type == Notification.Type.ORDER_CONFIRMED and notif.order_id:
        attachments = _build_invoice_attachment(notif.order)

        order_ref = notif.order.number or str(notif.order.id)[:8].upper()
        subject = f"Confirmación de compra #{order_ref} - Juhnios Rold S.A.S."
        plain_message = _build_order_confirmation_text(notif)
        html_message = _build_order_confirmation_html(notif)

    elif notif.order_id and notif.title == RECOVERY_NOTIFICATION_TITLE:
        subject = "🛍️ ¡Tus productos te están esperando! - Juhnios Rold"
        plain_message, html_message = _build_recovery_email(notif)

    from django.utils import timezone

    try:
        _send_email(
            subject=subject,
            message=plain_message,
            recipient=notif.customer.email,
            attachments=attachments,
            html_message=html_message,
        )
    except Exception as exc:
        logger.exception("Error enviando el email de la notificación %s.", notification_id)
        Notification.objects.filter(pk=notif.pk).update(
            email_status=Notification.EmailStatus.FAILED,
            email_error=str(exc)[:300],
        )
        raise

    Notification.objects.filter(pk=notif.pk).update(
        email_status=Notification.EmailStatus.SENT,
        email_sent_at=timezone.now(),
        email_error="",
    )


def _build_invoice_attachment(order):
    from apps.finance.infrastructure.invoice_pdf import render_invoice_pdf
    from apps.finance.infrastructure.models import SalesInvoice

    invoice = (
        SalesInvoice.objects.filter(order=order)
        .select_related("order__customer", "payment")
        .prefetch_related("lines")
        .first()
    )

    if invoice is None:
        logger.warning(
            "No se encontró factura para el pedido %s al enviar el email de pago confirmado.",
            order.id,
        )
        return []

    try:
        pdf_buffer = render_invoice_pdf(invoice)
    except Exception:
        logger.exception(
            "No fue posible generar el PDF de la factura %s para el email.",
            invoice.id,
        )
        return []

    return [
        {
            "filename": f"{invoice.number}.pdf",
            "content": pdf_buffer.getvalue(),
            "mimetype": "application/pdf",
        }
    ]


def _build_order_confirmation_text(notif):
    order = notif.order
    customer = notif.customer
    order_ref = order.number or str(order.id)[:8].upper()

    return f"""
Hola {getattr(customer, "first_name", "") or customer.email},

Gracias por comprar en Juhnios Rold S.A.S.

Hemos recibido correctamente tu pedido #{order_ref}.
Adjunto encontrarás el documento correspondiente a tu compra, si aplica.

Resumen:
- Pedido: #{order_ref}
- Cliente: {customer.email}
- Estado: Compra confirmada

Nuestro equipo revisará y gestionará tu pedido para continuar con el proceso de preparación y despacho.

Canales de atención:
Correo: servicioalcliente@juhniosrold.com
WhatsApp: disponible según los canales oficiales de la empresa

Recomendaciones:
1. Revisa que tus datos de contacto y entrega estén correctos.
2. Conserva este correo como soporte de tu compra.
3. Si tienes alguna novedad con tu pedido, comunícate con nuestro equipo de atención.

Juhnios Rold S.A.S.
Productos cosméticos capilares y corporales.
"""


def _build_order_confirmation_html(notif):
    order = notif.order
    customer = notif.customer

    customer_name = (
        getattr(customer, "first_name", None)
        or getattr(customer, "name", None)
        or "cliente"
    )

    order_ref = order.number or str(order.id)[:8].upper()
    customer_email = customer.email

    html = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Confirmación de compra</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, Helvetica, sans-serif; color:#222222;">

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:24px 0;">
        <tr>
            <td align="center">

                <table width="640" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e5e5e5;">

                    <!-- ENCABEZADO -->
                    <tr>
                        <td style="background-color:#111111; padding:26px 32px; text-align:center;">
                            <h1 style="margin:0; color:#ffffff; font-size:24px; letter-spacing:0.5px;">
                                Juhnios Rold S.A.S.
                            </h1>
                            <p style="margin:8px 0 0; color:#d9c28f; font-size:14px;">
                                Belleza, cuidado capilar y bienestar corporal
                            </p>
                        </td>
                    </tr>

                    <!-- MENSAJE PRINCIPAL -->
                    <tr>
                        <td style="padding:32px;">
                            <h2 style="margin:0 0 12px; font-size:22px; color:#111111;">
                                ¡Tu compra fue confirmada!
                            </h2>

                            <p style="margin:0 0 16px; font-size:15px; line-height:1.6;">
                                Hola <strong>__CUSTOMER_NAME__</strong>, gracias por comprar en
                                <strong>Juhnios Rold S.A.S.</strong>. Hemos recibido correctamente tu pedido
                                y nuestro equipo iniciará el proceso de preparación y gestión correspondiente.
                            </p>

                            <p style="margin:0 0 20px; font-size:15px; line-height:1.6;">
                                En este correo encontrarás la información principal de tu compra. 
                                Si aplica, también recibirás la factura o documento soporte adjunto.
                            </p>
                        </td>
                    </tr>

                    <!-- RESUMEN DE COMPRA -->
                    <tr>
                        <td style="padding:0 32px 28px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                                <tr>
                                    <td colspan="2" style="background-color:#f0e7d2; padding:12px 16px; font-weight:bold; font-size:16px; color:#111111;">
                                        Resumen de tu compra
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding:12px 16px; border-bottom:1px solid #eeeeee; font-size:14px;">
                                        Número de pedido
                                    </td>
                                    <td style="padding:12px 16px; border-bottom:1px solid #eeeeee; font-size:14px; text-align:right;">
                                        #__ORDER_ID__
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding:12px 16px; border-bottom:1px solid #eeeeee; font-size:14px;">
                                        Correo del cliente
                                    </td>
                                    <td style="padding:12px 16px; border-bottom:1px solid #eeeeee; font-size:14px; text-align:right;">
                                        __CUSTOMER_EMAIL__
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding:12px 16px; border-bottom:1px solid #eeeeee; font-size:14px;">
                                        Estado
                                    </td>
                                    <td style="padding:12px 16px; border-bottom:1px solid #eeeeee; font-size:14px; text-align:right;">
                                        <strong>Compra confirmada</strong>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- INFORMACIÓN IMPORTANTE -->
                    <tr>
                        <td style="padding:0 32px 28px;">
                            <div style="border:1px solid #eadfca; background-color:#fffaf1; border-radius:8px; padding:18px;">
                                <h3 style="margin:0 0 10px; font-size:16px; color:#111111;">
                                    Información importante
                                </h3>

                                <ul style="margin:0; padding-left:18px; font-size:14px; line-height:1.7;">
                                    <li>Revisa que tus datos de contacto y entrega estén correctamente registrados.</li>
                                    <li>Conserva este correo como soporte de tu compra.</li>
                                    <li>El tiempo de preparación y despacho puede variar según la ciudad, disponibilidad del producto y método de envío.</li>
                                    <li>Si notas alguna novedad en tu pedido, comunícate con nuestro equipo de atención al cliente.</li>
                                </ul>
                            </div>
                        </td>
                    </tr>

                    <!-- ATENCIÓN AL CLIENTE -->
                    <tr>
                        <td style="padding:0 32px 28px;">
                            <h3 style="margin:0 0 10px; font-size:16px;">
                                Canales de atención
                            </h3>

                            <p style="margin:0; font-size:14px; line-height:1.7;">
                                Para consultas sobre tu pedido, cambios, novedades de entrega o soporte comercial,
                                puedes comunicarte con nosotros a través de nuestros canales oficiales.
                            </p>

                            <p style="margin:14px 0 0; font-size:14px; line-height:1.7;">
                                <strong>Correo:</strong> servicioalcliente@juhniosrold.com<br>
                                <strong>Empresa:</strong> Productos Juhnios Rold S.A.S.<br>
                                <strong>Ubicación:</strong> Barranquilla, Atlántico, Colombia
                            </p>
                        </td>
                    </tr>

                    <!-- AVISO LEGAL -->
                    <tr>
                        <td style="padding:0 32px 30px;">
                            <div style="border-top:1px solid #eeeeee; padding-top:18px;">
                                <p style="margin:0 0 8px; font-size:12px; line-height:1.6; color:#666666;">
                                    <strong>Aviso de privacidad:</strong> Has recibido este correo porque realizaste una compra
                                    o registraste tus datos en los canales comerciales de Juhnios Rold S.A.S. La información
                                    será utilizada únicamente para la gestión de tu pedido, atención al cliente, facturación,
                                    despacho y comunicaciones relacionadas con nuestros productos y servicios.
                                </p>

                                <p style="margin:0; font-size:12px; line-height:1.6; color:#666666;">
                                    Este mensaje es informativo. Si no reconoces esta compra o consideras que recibiste este
                                    correo por error, por favor comunícate con nuestro equipo de atención.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- PIE -->
                    <tr>
                        <td style="background-color:#111111; padding:20px 32px; text-align:center;">
                            <p style="margin:0; color:#ffffff; font-size:13px;">
                                Juhnios Rold S.A.S.
                            </p>
                            <p style="margin:6px 0 0; color:#d9c28f; font-size:12px;">
                                Cosmética capilar y corporal para el cuidado diario
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>
"""

    html = html.replace("__CUSTOMER_NAME__", str(customer_name))
    html = html.replace("__ORDER_ID__", str(order_ref))
    html = html.replace("__CUSTOMER_EMAIL__", str(customer_email))
    return html