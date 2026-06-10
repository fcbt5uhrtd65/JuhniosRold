from django.conf import settings
from django.db import models

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
