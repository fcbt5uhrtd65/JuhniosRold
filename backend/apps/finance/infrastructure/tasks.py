import logging

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ..domain.exceptions import (
    DianConfigurationError,
    DianDuplicatePendingError,
    DianRejectionError,
    DianTransientError,
)
from .factus_client import FactusClient
from .models import SalesInvoice

logger = logging.getLogger(__name__)

# Catálogo de tipos de documento DIAN (ver "Campos de la factura" > customer.identification_document_code).
DIAN_DOCUMENT_TYPE_MAP = {
    "CC": "13",
    "NIT": "31",
    "CE": "22",
    "PASSPORT": "41",
    "OTHER": "42",
}

# 1 = persona jurídica, 2 = persona natural (customer.legal_organization_code).
LEGAL_ORGANIZATION_NATURAL = "2"
LEGAL_ORGANIZATION_COMPANY = "1"

# 42 = "Otros" (métodos de pago Factus); usado como fallback genérico.
DEFAULT_PAYMENT_METHOD_CODE = "42"
DEFAULT_PAYMENT_FORM_CONTADO = "1"
# 94 = "Unidad" (unit_measure_code); 999 = estándar no especificado (standard_code).
DEFAULT_UNIT_MEASURE_CODE = "94"
DEFAULT_STANDARD_CODE = "999"
# 01 = IVA (items.*.taxes.*.code).
TAX_CODE_IVA = "01"


def _build_bill_payload(invoice: SalesInvoice) -> dict:
    customer = invoice.order.customer
    is_business = bool(invoice.customer_business_name)

    customer_payload = {
        "identification_document_code": DIAN_DOCUMENT_TYPE_MAP.get(customer.document_type, "42"),
        "identification": customer.document_number,
        "legal_organization_code": (
            LEGAL_ORGANIZATION_COMPANY if is_business else LEGAL_ORGANIZATION_NATURAL
        ),
        "address": invoice.billing_address,
        "email": invoice.customer_email,
        "phone": customer.phone,
    }
    if is_business:
        customer_payload["company"] = invoice.customer_business_name
    else:
        customer_payload["names"] = invoice.customer_name

    return {
        "reference_code": invoice.number,
        "observation": f"Pedido {invoice.order.number}",
        "payment_details": [
            {
                "payment_form": DEFAULT_PAYMENT_FORM_CONTADO,
                "payment_method_code": DEFAULT_PAYMENT_METHOD_CODE,
                "reference_code": invoice.payment.reference,
                "amount": str(invoice.total),
            }
        ],
        "customer": customer_payload,
        "items": [
            {
                "code_reference": line.sku,
                "name": line.product_name,
                "quantity": str(line.quantity),
                "price": str(line.unit_price),
                "unit_measure_code": DEFAULT_UNIT_MEASURE_CODE,
                "standard_code": DEFAULT_STANDARD_CODE,
                "taxes": [
                    {"code": TAX_CODE_IVA, "rate": str(invoice.tax_rate)},
                ],
            }
            for line in invoice.lines.all()
        ],
    }


@shared_task(bind=True, max_retries=settings.FACTUS_MAX_RETRIES)
def submit_invoice_to_dian(self, invoice_id):
    invoice = (
        SalesInvoice.objects.select_related("order__customer")
        .prefetch_related("lines")
        .get(pk=invoice_id)
    )
    if invoice.dian_status == SalesInvoice.DianStatus.VALIDATED:
        return

    try:
        client = FactusClient()
        payload = _build_bill_payload(invoice)
        result = client.validate_bill(payload)
    except DianConfigurationError:
        logger.warning(
            "Factus no está configurado; factura %s queda pendiente.", invoice.number
        )
        return
    except DianDuplicatePendingError as exc:
        # La API reporta una factura sin enviar a la DIAN con esta referencia:
        # hay que eliminarla y reintentar la creación (ver doc "Crear y validar").
        logger.warning(
            "Factus reporta factura pendiente duplicada para %s, eliminando y reintentando: %s",
            invoice.number,
            exc,
        )
        try:
            FactusClient().delete_bill(invoice.number)
        except (DianConfigurationError, DianRejectionError, DianTransientError):
            logger.exception("No fue posible eliminar la factura duplicada %s en Factus.", invoice.number)
        invoice.dian_retry_count += 1
        invoice.dian_error_detail = str(exc)
        invoice.save(update_fields=("dian_retry_count", "dian_error_detail", "updated_at"))
        if invoice.dian_retry_count >= settings.FACTUS_MAX_RETRIES:
            return
        self.retry(exc=exc, countdown=30)
        return
    except DianRejectionError as exc:
        invoice.dian_status = SalesInvoice.DianStatus.FAILED
        invoice.dian_error_detail = str(exc)
        invoice.save(update_fields=("dian_status", "dian_error_detail", "updated_at"))
        logger.error("Factus rechazó la factura %s: %s", invoice.number, exc)
        return
    except DianTransientError as exc:
        invoice.dian_retry_count += 1
        invoice.dian_error_detail = str(exc)
        invoice.save(update_fields=("dian_retry_count", "dian_error_detail", "updated_at"))
        if invoice.dian_retry_count >= settings.FACTUS_MAX_RETRIES:
            logger.error(
                "Factura %s agotó reintentos ante Factus: %s", invoice.number, exc
            )
            return
        self.retry(exc=exc, countdown=min(60 * 2 ** invoice.dian_retry_count, 3600))
        return

    # Campos confirmados contra la doc oficial "Crear y validar" > Respuesta > data.*.
    bill_data = result.get("data") or {}
    links = bill_data.get("links") or {}
    is_validated = bill_data.get("is_validated", True)
    with transaction.atomic():
        invoice.dian_status = (
            SalesInvoice.DianStatus.VALIDATED if is_validated else SalesInvoice.DianStatus.PENDING
        )
        invoice.dian_cufe = bill_data.get("cufe", "")
        invoice.dian_qr_url = links.get("qr", "") or links.get("public_url", "")
        invoice.factus_invoice_id = bill_data.get("reference_code", "")
        invoice.factus_number = bill_data.get("number", "")
        invoice.dian_validated_at = timezone.now() if is_validated else None
        invoice.dian_error_detail = ""
        invoice.save(
            update_fields=(
                "dian_status",
                "dian_cufe",
                "dian_qr_url",
                "factus_invoice_id",
                "factus_number",
                "dian_validated_at",
                "dian_error_detail",
                "updated_at",
            )
        )


@shared_task
def retry_pending_dian_invoices():
    invoice_ids = list(
        SalesInvoice.objects.filter(
            dian_status=SalesInvoice.DianStatus.PENDING,
            dian_retry_count__lt=settings.FACTUS_MAX_RETRIES,
        ).values_list("id", flat=True)
    )
    for invoice_id in invoice_ids:
        submit_invoice_to_dian.delay(invoice_id)
    return len(invoice_ids)
