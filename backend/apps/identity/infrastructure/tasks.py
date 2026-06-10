from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task
def send_password_reset_email(email, token):
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5174")
    reset_url = f"{frontend_url}/reset-password?token={token}"
    return send_mail(
        subject="Recuperación de contraseña - Juhnios Rold",
        message=f"Usa este enlace para restablecer tu contraseña: {reset_url}",
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@juhniosrold.com"),
        recipient_list=[email],
    )
