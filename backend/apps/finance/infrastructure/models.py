import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from shared.infrastructure.models import BaseModel


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
    customer_name = models.CharField(max_length=240)
    customer_email = models.EmailField()
    customer_document = models.CharField(max_length=80)
    billing_address = models.TextField(blank=True)
    issued_at = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = f"FAC-JR-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)


class SalesInvoiceLine(BaseModel):
    invoice = models.ForeignKey(
        SalesInvoice,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product_name = models.CharField(max_length=180)
    sku = models.CharField(max_length=80)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
