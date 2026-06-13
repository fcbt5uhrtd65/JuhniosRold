from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.commerce.domain.exceptions import PaymentConfigurationError
from apps.commerce.infrastructure.wompi_client import WompiClient


def _masked(value):
    if not value:
        return "(vacio)"
    if len(value) <= 12:
        return "*" * len(value)
    return f"{value[:10]}...{value[-4:]}"


class Command(BaseCommand):
    help = "Valida la configuracion de Wompi sin exponer credenciales."

    def handle(self, *args, **options):
        if settings.PAYMENT_PROVIDER != "wompi":
            raise CommandError(
                "PAYMENT_PROVIDER no es 'wompi'; el flujo real de Wompi esta desactivado."
            )

        try:
            client = WompiClient()
        except PaymentConfigurationError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS("Configuracion Wompi valida"))
        self.stdout.write(f"PAYMENT_PROVIDER={settings.PAYMENT_PROVIDER}")
        self.stdout.write(f"WOMPI_ENVIRONMENT={client.environment}")
        self.stdout.write(f"WOMPI_BASE_URL={client.base_url}")
        self.stdout.write(f"WOMPI_PUBLIC_KEY={_masked(client.public_key)}")
        self.stdout.write(f"WOMPI_PRIVATE_KEY={_masked(client.private_key)}")
        self.stdout.write(f"WOMPI_EVENTS_SECRET={_masked(client.events_secret)}")
        self.stdout.write(
            f"WOMPI_INTEGRITY_SECRET={_masked(client.integrity_secret)}"
        )
