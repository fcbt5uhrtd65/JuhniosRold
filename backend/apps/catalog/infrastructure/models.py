from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models

from shared.infrastructure.models import BaseModel


class Category(BaseModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    image_url = models.TextField(blank=True)
    parent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class FlipbookCatalog(BaseModel):
    title = models.CharField(max_length=140)
    label = models.CharField(max_length=140, blank=True)
    description = models.TextField(blank=True)
    url = models.URLField(max_length=500)
    accent_color = models.CharField(
        max_length=7,
        default="#2D3A1F",
        validators=[
            RegexValidator(
                regex=r"^#[0-9A-Fa-f]{6}$",
                message="Ingresa un color hexadecimal válido, por ejemplo #2D3A1F.",
            )
        ],
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("sort_order", "title")

    def __str__(self):
        return self.title


class Product(BaseModel):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=180)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    image_url = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class ProductVariant(BaseModel):
    class PresentationUnit(models.TextChoices):
        ML = "ML", "ML"
        LT = "LT", "LT"
        GR = "GR", "GR"
        KG = "KG", "KG"
        UND = "UND", "UND"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=150)
    presentation_number = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    presentation_unit = models.CharField(max_length=3, choices=PresentationUnit.choices, blank=True)
    image_url = models.TextField(blank=True)
    attributes = models.JSONField(default=dict, blank=True)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["presentation_number", "sku"]

    @property
    def presentation_label(self):
        if self.presentation_number is not None and self.presentation_unit:
            number = f"{self.presentation_number:f}"
            if "." in number:
                number = number.rstrip("0").rstrip(".")
            return f"{number} {self.presentation_unit}"
        return self.name

    def __str__(self):
        return f"{self.product.name} - {self.presentation_label}"


class Price(BaseModel):
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="prices")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="COP")
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)


class ProductImage(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.TextField()
    alt_text = models.CharField(max_length=180, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    is_primary = models.BooleanField(default=False)


class ProductVariantImage(BaseModel):
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, related_name="images")
    image = models.TextField()
    alt_text = models.CharField(max_length=180, blank=True)
    position = models.PositiveSmallIntegerField(default=0)
    is_primary = models.BooleanField(default=False)


class ProductReview(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="product_reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["product", "user"], name="unique_review_per_user_product"),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.user} ({self.rating}★)"
