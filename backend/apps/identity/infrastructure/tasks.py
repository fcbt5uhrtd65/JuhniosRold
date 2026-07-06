import base64
import json

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage, EmailMultiAlternatives
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _send_with_resend(*, subject, message, recipient, attachments=None, html_message=None):
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY no esta configurada.")

    payload = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [recipient],
        "subject": subject,
        "text": message,
    }
    if html_message:
        payload["html"] = html_message
    if attachments:
        payload["attachments"] = [
            {
                "filename": attachment["filename"],
                "content": base64.b64encode(attachment["content"]).decode("ascii"),
            }
            for attachment in attachments
        ]

    request = Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "JuhniosRold/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            return response.status
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Resend respondio HTTP {exc.code}: {body}") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("No fue posible enviar el correo con Resend.") from exc


def _send_email(*, subject, message, recipient, attachments=None, html_message=None):
    if settings.EMAIL_PROVIDER == "resend":
        return _send_with_resend(
            subject=subject,
            message=message,
            recipient=recipient,
            attachments=attachments,
            html_message=html_message,
        )

    email_cls = EmailMultiAlternatives if html_message else EmailMessage
    email = email_cls(
        subject=subject,
        body=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@juhniosrold.com"),
        to=[recipient],
    )
    if html_message:
        email.attach_alternative(html_message, "text/html")
    for attachment in attachments or []:
        email.attach(
            attachment["filename"],
            attachment["content"],
            attachment.get("mimetype", "application/octet-stream"),
        )
    return email.send()


@shared_task
def send_password_reset_email(email, token):
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5174")
    reset_url = f"{frontend_url}/reset-password?token={token}"
    return _send_email(
        subject="Recuperación de contraseña - Juhnios Rold",
        message=f"Usa este enlace para restablecer tu contraseña: {reset_url}",
        recipient=email,
    )


@shared_task
def send_password_reset_code_email(email, code):
    ttl = settings.PASSWORD_RESET_CODE_TTL_MINUTES
    return _send_email(
        subject="Codigo para restablecer tu contraseña - Juhnios Rold",
        message=(
            "Tu codigo para restablecer la contraseña en Juhnios Rold es: "
            f"{code}\n\nEste codigo vence en {ttl} minutos. Si no solicitaste "
            "este cambio, puedes ignorar este correo."
        ),
        recipient=email,
    )


@shared_task
def send_registration_verification_email(email, code):
    ttl = settings.REGISTRATION_CODE_TTL_MINUTES
    return _send_email(
        subject="Codigo de verificacion - Juhnios Rold",
        message=(
            "Tu codigo de verificacion para crear tu cuenta en Juhnios Rold es: "
            f"{code}\n\nEste codigo vence en {ttl} minutos. Si no solicitaste este "
            "registro, puedes ignorar este correo."
        ),
        recipient=email,
    )
