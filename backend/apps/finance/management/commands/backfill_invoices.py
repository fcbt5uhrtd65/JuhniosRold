from django.core.management.base import BaseCommand

from apps.commerce.infrastructure.models import Payment

from ...application.invoicing import GenerateSalesInvoice
from ...infrastructure.models import SalesInvoice


class Command(BaseCommand):
    help = "Genera facturas para pagos aprobados que aún no tienen una factura asociada."

    def handle(self, *args, **options):
        approved_payments = Payment.objects.filter(
            status=Payment.Status.APPROVED,
            invoice__isnull=True,
        ).select_related("order")

        created = 0
        for payment in approved_payments:
            GenerateSalesInvoice().execute(order=payment.order, payment=payment)
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Facturas generadas: {created}."))
        self.stdout.write(f"Total de facturas en el sistema: {SalesInvoice.objects.count()}.")
