from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from shared.infrastructure.models import BaseModel


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
