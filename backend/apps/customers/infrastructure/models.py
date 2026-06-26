from django.conf import settings
from django.db import models

from shared.infrastructure.models import BaseModel


class CustomerSegment(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Customer(BaseModel):
    class PurchaseMode(models.TextChoices):
        RETAIL = "RETAIL", "Compra personal / minorista"
        WHOLESALE = "WHOLESALE", "Compra mayorista"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customer_profile",
    )
    document_type = models.CharField(max_length=20, default="CC")
    document_number = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    purchase_mode = models.CharField(
        max_length=20,
        choices=PurchaseMode.choices,
        default=PurchaseMode.RETAIL,
    )
    wholesale_code = models.CharField(max_length=40, unique=True, blank=True)

    # campos de empresa (solo relevantes cuando purchase_mode=WHOLESALE)
    company_id_type = models.CharField(max_length=30, blank=True)
    company_id_type_other = models.CharField(max_length=80, blank=True)
    company_id_number = models.CharField(max_length=60, blank=True)
    company_name = models.CharField(max_length=200, blank=True)
    business_type = models.CharField(max_length=40, blank=True)
    is_international_distributor = models.BooleanField(default=False)
    company_phone = models.CharField(max_length=30, blank=True)

    segments = models.ManyToManyField(CustomerSegment, blank=True, related_name="customers")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        if not self.wholesale_code:
            seed = self.document_number or self.email or str(self.id)
            clean = "".join(ch for ch in seed.upper() if ch.isalnum())[:8] or str(self.id).replace("-", "")[:8].upper()
            base = f"JR-MAY-{clean}"
            candidate = base
            suffix = 1
            while Customer.objects.filter(wholesale_code=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}-{suffix}"
                suffix += 1
            self.wholesale_code = candidate
        super().save(*args, **kwargs)


class CustomerAddress(BaseModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="addresses")
    address = models.TextField()
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    reference = models.TextField(blank=True)
    is_default = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.address} ({self.customer})"


class CustomerContact(BaseModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_primary = models.BooleanField(default=False)

    def __str__(self):
        return self.name
