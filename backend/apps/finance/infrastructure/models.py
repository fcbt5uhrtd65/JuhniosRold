import hashlib
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from shared.infrastructure.models import BaseModel

from .issuer import COMPANY_NIT


class FinancialTransaction(BaseModel):
    class Type(models.TextChoices):
        INCOME = "INCOME", "Ingreso"
        EXPENSE = "EXPENSE", "Egreso"

    transaction_type = models.CharField(max_length=20, choices=Type.choices)
    category = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    occurred_on = models.DateField()
    reference = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )


class SalesInvoice(BaseModel):
    class Status(models.TextChoices):
        ISSUED = "ISSUED", "Emitida"
        VOIDED = "VOIDED", "Anulada"

    class DianStatus(models.TextChoices):
        PENDING = "PENDING", "Pendiente de validación DIAN"
        VALIDATED = "VALIDATED", "Validada por la DIAN"
        FAILED = "FAILED", "Rechazada por la DIAN"

    number = models.CharField(max_length=40, unique=True, editable=False)
    order = models.OneToOneField(
        "commerce.Order",
        on_delete=models.PROTECT,
        related_name="invoice",
    )
    payment = models.OneToOneField(
        "commerce.Payment",
        on_delete=models.PROTECT,
        related_name="invoice",
    )
    financial_transaction = models.OneToOneField(
        FinancialTransaction,
        on_delete=models.PROTECT,
        related_name="invoice",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ISSUED,
    )
    currency = models.CharField(max_length=3, default="COP")
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    shipping_cost = models.DecimalField(max_digits=14, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("19.00"))
    customer_name = models.CharField(max_length=240)
    customer_business_name = models.CharField(max_length=200, blank=True)
    customer_email = models.EmailField()
    customer_document = models.CharField(max_length=80)
    billing_address = models.TextField(blank=True)
    issued_at = models.DateTimeField(default=timezone.now)
    dian_resolution = models.CharField(
        max_length=240,
        blank=True,
        help_text="Texto de la resolución de facturación DIAN vigente al momento de emisión.",
    )
    cufe = models.CharField(
        max_length=96,
        unique=True,
        editable=False,
        blank=True,
        help_text="Hash local de referencia. No es un CUFE oficial DIAN, ver dian_cufe.",
    )
    dian_status = models.CharField(
        max_length=20,
        choices=DianStatus.choices,
        default=DianStatus.PENDING,
    )
    dian_cufe = models.CharField(
        max_length=200,
        blank=True,
        help_text="CUFE real devuelto por Factus tras la validación ante la DIAN.",
    )
    dian_qr_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="URL de verificación oficial devuelta por Factus para el QR.",
    )
    factus_invoice_id = models.CharField(max_length=80, blank=True)
    factus_number = models.CharField(max_length=80, blank=True)
    dian_validated_at = models.DateTimeField(null=True, blank=True)
    dian_error_detail = models.TextField(blank=True)
    dian_retry_count = models.PositiveIntegerField(default=0)

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = f"FAC-JR-{uuid.uuid4().hex[:12].upper()}"
        if not self.cufe:
            seed = f"{self.number}{self.total}{self.issued_at.isoformat()}{COMPANY_NIT}{uuid.uuid4().hex}"
            self.cufe = hashlib.sha256(seed.encode("utf-8")).hexdigest()
        super().save(*args, **kwargs)


class SalesInvoiceLine(BaseModel):
    invoice = models.ForeignKey(
        SalesInvoice,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product_name = models.CharField(max_length=180)
    sku = models.CharField(max_length=80)
    presentation = models.CharField(max_length=40, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
