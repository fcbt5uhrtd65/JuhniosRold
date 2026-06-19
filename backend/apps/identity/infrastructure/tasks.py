import json

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _send_with_resend(*, subject, message, recipient):
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY no esta configurada.")

    payload = json.dumps(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [recipient],
            "subject": subject,
            "text": message,
        }
    ).encode("utf-8")
    request = Request(
        "https://api.resend.com/emails",
        data=payload,
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


def _send_email(*, subject, message, recipient):
    if settings.EMAIL_PROVIDER == "resend":
        return _send_with_resend(subject=subject, message=message, recipient=recipient)
    return send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@juhniosrold.com"),
        recipient_list=[recipient],
    )


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
