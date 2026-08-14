from decimal import Decimal
import re
import secrets
import string

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from shared.infrastructure.models import BaseModel


SELLER_CODE_ALPHABET = string.ascii_uppercase + string.digits


def normalize_seller_discount_code(code: str) -> str:
    return re.sub(r"\s+", "", str(code or "")).upper()


def generate_seller_discount_code() -> str:
    suffix = "".join(secrets.choice(SELLER_CODE_ALPHABET) for _ in range(8))
    return f"JR-{suffix}"


class Promotion(BaseModel):
    class DiscountType(models.TextChoices):
        PERCENTAGE = "PERCENTAGE", "Porcentaje"
        FIXED_AMOUNT = "FIXED_AMOUNT", "Monto fijo"

    class Scope(models.TextChoices):
        PRODUCT = "PRODUCT", "Producto"
        VARIANT = "VARIANT", "Variante"
        CATEGORY = "CATEGORY", "Categoría"

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)

    discount_type = models.CharField(max_length=20, choices=DiscountType.choices)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)

    scope = models.CharField(max_length=20, choices=Scope.choices)
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.CASCADE, related_name="promotions", null=True, blank=True,
    )
    variant = models.ForeignKey(
        "catalog.ProductVariant", on_delete=models.CASCADE, related_name="promotions", null=True, blank=True,
    )
    category = models.ForeignKey(
        "catalog.Category", on_delete=models.CASCADE, related_name="promotions", null=True, blank=True,
    )

    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    priority = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("-priority", "-created_at")
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(scope="PRODUCT", product__isnull=False, variant__isnull=True, category__isnull=True)
                    | models.Q(scope="VARIANT", variant__isnull=False, product__isnull=True, category__isnull=True)
                    | models.Q(scope="CATEGORY", category__isnull=False, product__isnull=True, variant__isnull=True)
                ),
                name="promotion_scope_matches_single_target",
            ),
            models.CheckConstraint(
                check=models.Q(ends_at__isnull=True) | models.Q(ends_at__gt=models.F("starts_at")),
                name="promotion_ends_after_starts",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_discount_type_display()} {self.discount_value})"

    def clean(self):
        target_count = sum(x is not None for x in (self.product_id, self.variant_id, self.category_id))
        if target_count != 1:
            raise ValidationError("Debe asociarse exactamente un producto, variante o categoría.")
        if self.discount_type == self.DiscountType.PERCENTAGE and not (0 < self.discount_value <= 100):
            raise ValidationError("El porcentaje de descuento debe estar entre 0 y 100.")
        if self.discount_type == self.DiscountType.FIXED_AMOUNT and self.discount_value <= 0:
            raise ValidationError("El monto de descuento debe ser mayor a 0.")
        if self.ends_at and self.starts_at and self.ends_at <= self.starts_at:
            raise ValidationError("La fecha de finalización debe ser posterior a la de inicio.")

    def is_currently_active(self, at=None):
        at = at or timezone.now()
        if not self.is_active or self.deleted_at is not None:
            return False
        if self.starts_at > at:
            return False
        if self.ends_at and self.ends_at <= at:
            return False
        return True

    def apply_to(self, amount: Decimal) -> Decimal:
        if self.discount_type == self.DiscountType.PERCENTAGE:
            discounted = amount * (Decimal(1) - self.discount_value / Decimal(100))
        else:
            discounted = amount - self.discount_value
        discounted = max(discounted, Decimal("0"))
        return discounted.quantize(Decimal("0.01"))


class SellerDiscountCode(BaseModel):
    class DiscountType(models.TextChoices):
        PERCENTAGE = "PERCENTAGE", "Porcentaje"
        FIXED_AMOUNT = "FIXED_AMOUNT", "Monto fijo"

    code = models.CharField(max_length=40, unique=True, blank=True)
    seller = models.ForeignKey(
        "employees.Employee",
        on_delete=models.PROTECT,
        related_name="seller_discount_codes",
    )
    name = models.CharField(max_length=120, blank=True)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    min_order_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    uses_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_seller_discount_codes",
    )

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                check=models.Q(ends_at__gt=models.F("starts_at")),
                name="seller_discount_code_ends_after_starts",
            ),
            models.CheckConstraint(
                check=models.Q(max_uses__isnull=True) | models.Q(max_uses__gt=0),
                name="seller_discount_code_max_uses_positive",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.seller}"

    def clean(self):
        self.code = normalize_seller_discount_code(self.code)
        if self.code and not re.fullmatch(r"[A-Z0-9-]+", self.code):
            raise ValidationError({"code": "El codigo solo puede tener letras, numeros y guiones."})
        if self.discount_type == self.DiscountType.PERCENTAGE and not (0 < self.discount_value <= 100):
            raise ValidationError({"discount_value": "El porcentaje debe estar entre 0 y 100."})
        if self.discount_type == self.DiscountType.FIXED_AMOUNT and self.discount_value <= 0:
            raise ValidationError({"discount_value": "El monto debe ser mayor a 0."})
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValidationError({"ends_at": "La fecha final debe ser posterior a la inicial."})
        if self.max_uses is not None and self.max_uses <= 0:
            raise ValidationError({"max_uses": "Los usos maximos deben ser mayores a 0."})

    def save(self, *args, **kwargs):
        if not self.code:
            while True:
                candidate = generate_seller_discount_code()
                if not SellerDiscountCode.all_objects.filter(code=candidate).exists():
                    self.code = candidate
                    break
        self.clean()
        super().save(*args, **kwargs)

    def is_currently_active(self, at=None):
        at = at or timezone.now()
        if not self.is_active or self.deleted_at is not None:
            return False
        if self.starts_at > at:
            return False
        if self.ends_at <= at:
            return False
        if self.max_uses is not None and self.uses_count >= self.max_uses:
            return False
        return True

    def discount_for(self, amount: Decimal) -> Decimal:
        if amount <= 0:
            return Decimal("0.00")
        if self.discount_type == self.DiscountType.PERCENTAGE:
            discount = amount * (self.discount_value / Decimal("100"))
        else:
            discount = self.discount_value
        return min(amount, discount).quantize(Decimal("0.01"))

    @property
    def seller_name(self):
        return str(self.seller).strip()
