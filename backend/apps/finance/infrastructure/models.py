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
        help_text="Código único de verificación de la factura, usado como contenido del QR.",
    )

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


class PaymentAccount(BaseModel):
    """Cuenta de cobro emitida por un contratista a un cliente.

    El consecutivo (``number``) es único y se calcula con el máximo de TODOS los
    registros (incluidos los eliminados) + 1, por lo que nunca se reutiliza.
    No se edita: solo se crea, consulta y elimina (soft delete).
    """

    number = models.PositiveIntegerField(unique=True, editable=False)
    issue_date = models.DateField()
    service_title = models.CharField(max_length=200)

    # Prestador
    contractor_name = models.CharField(max_length=200)
    contractor_document = models.CharField(max_length=30)
    contractor_document_city = models.CharField(max_length=120, blank=True)
    contractor_address = models.CharField(max_length=240, blank=True)
    contractor_city = models.CharField(max_length=120, blank=True)
    contractor_email = models.CharField(max_length=254, blank=True)
    contractor_phone = models.CharField(max_length=40, blank=True)

    # Cliente
    client_name = models.CharField(max_length=200)
    client_branch = models.CharField(max_length=200, blank=True)
    client_document = models.CharField(max_length=40)
    client_address = models.CharField(max_length=240, blank=True)
    client_city = models.CharField(max_length=120, blank=True)
    client_legal_rep = models.CharField(max_length=200, blank=True)
    client_legal_rep_document = models.CharField(max_length=40, blank=True)

    # Concepto
    description = models.TextField()
    contract_reference = models.CharField(max_length=200, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    supervisor = models.CharField(max_length=200, blank=True)
    requisition_number = models.CharField(max_length=60, blank=True)
    requisition_date = models.DateField(null=True, blank=True)

    # Valor
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    vat_note = models.CharField(max_length=120, default="No aplica", blank=True)
    no_withholding_letter = models.BooleanField(default=False)
    contract_object = models.TextField(blank=True)
    monthly_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    # Pago
    bank_name = models.CharField(max_length=120, blank=True)
    account_type = models.CharField(max_length=40, blank=True)
    account_number = models.CharField(max_length=60, blank=True)
    account_holder = models.CharField(max_length=200, blank=True)
    account_holder_document = models.CharField(max_length=30, blank=True)

    signature = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_accounts",
    )

    class Meta(BaseModel.Meta):
        ordering = ("-number",)

    def __str__(self):
        return f"Cuenta de cobro {self.number:03d}"

    @classmethod
    def next_number(cls) -> int:
        """Siguiente consecutivo: máximo de todos los registros (eliminados
        incluidos) + 1."""
        current = cls.all_objects.aggregate(top=models.Max("number"))["top"]
        return (current or 0) + 1
