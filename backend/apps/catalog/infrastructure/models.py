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
    attributes = models.JSONField(default=dict, blank=True)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    @property
    def presentation_label(self):
        if self.presentation_number is not None and self.presentation_unit:
            number = f"{self.presentation_number.normalize():f}".rstrip("0").rstrip(".")
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
