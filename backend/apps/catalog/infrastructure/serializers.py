from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Category, Price, Product, ProductImage, ProductVariant


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class PriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Price
        fields = "__all__"


class ProductVariantSerializer(serializers.ModelSerializer):
    prices = PriceSerializer(many=True, read_only=True)
    presentation_label = serializers.CharField(read_only=True)
    available_quantity = serializers.SerializerMethodField()
    minimum_quantity = serializers.SerializerMethodField()

    def _get_stock(self, obj):
        stocks = getattr(obj, "_prefetched_stocks", None)
        if stocks is None:
            stocks = list(obj.stocks.all())
        if not stocks:
            return None
        return stocks[0]

    def get_available_quantity(self, obj):
        stock = self._get_stock(obj)
        if stock is None:
            return None
        return float(stock.available_quantity)

    def get_minimum_quantity(self, obj):
        stock = self._get_stock(obj)
        if stock is None:
            return None
        return float(stock.minimum_quantity)

    class Meta:
        model = ProductVariant
        fields = "__all__"


MAX_IMAGES_PER_PRODUCT = 3


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = "__all__"

    def validate_product(self, product):
        existing = product.images.exclude(pk=getattr(self.instance, "pk", None))
        if existing.count() >= MAX_IMAGES_PER_PRODUCT:
            raise serializers.ValidationError(
                f"Un producto no puede tener más de {MAX_IMAGES_PER_PRODUCT} imágenes."
            )
        return product


class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = "__all__"


class CompleteProductSerializer(serializers.Serializer):
    """Crea Product + ProductVariant + Price en una sola transacción atómica.

    Evita el problema de productos huérfanos que quedaban en la base de datos
    cuando la creación de la variante o el precio fallaba después de que el
    producto ya se había creado en una llamada separada.
    """

    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    name = serializers.CharField(max_length=180)
    slug = serializers.SlugField(max_length=50)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    image_url = serializers.CharField(required=False, allow_blank=True, default="")
    images = serializers.ListField(
        child=serializers.CharField(allow_blank=True), required=False, default=list,
    )
    is_active = serializers.BooleanField(required=False, default=True)
    is_featured = serializers.BooleanField(required=False, default=False)

    sku = serializers.CharField(max_length=80)
    variant_name = serializers.CharField(max_length=150)
    presentation_number = serializers.DecimalField(
        max_digits=10, decimal_places=3, required=False, allow_null=True, default=None,
    )
    presentation_unit = serializers.ChoiceField(
        choices=ProductVariant.PresentationUnit.choices, required=False, allow_blank=True, default="",
    )
    variant_attributes = serializers.JSONField(required=False, default=dict)
    cost = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=Decimal("0"))

    price = serializers.DecimalField(max_digits=14, decimal_places=2)

    def validate_slug(self, value):
        if Product.objects.filter(slug=value).exists():
            raise serializers.ValidationError("Ya existe un producto con ese slug.")
        return value

    def validate_images(self, value):
        if len(value) > MAX_IMAGES_PER_PRODUCT:
            raise serializers.ValidationError(
                f"Un producto no puede tener más de {MAX_IMAGES_PER_PRODUCT} imágenes."
            )
        return value

    def validate_sku(self, value):
        if ProductVariant.objects.filter(sku=value).exists():
            raise serializers.ValidationError("Ya existe una variante con ese SKU/código.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        product = Product.objects.create(
            category=validated_data["category"],
            name=validated_data["name"],
            slug=validated_data["slug"],
            description=validated_data.get("description", ""),
            image_url=validated_data.get("image_url", ""),
            is_active=validated_data.get("is_active", True),
            is_featured=validated_data.get("is_featured", False),
        )
        for position, image_url in enumerate(validated_data.get("images") or []):
            if not image_url:
                continue
            ProductImage.objects.create(
                product=product,
                image=image_url,
                position=position,
                is_primary=position == 0,
            )
        variant = ProductVariant.objects.create(
            product=product,
            sku=validated_data["sku"],
            name=validated_data["variant_name"],
            presentation_number=validated_data.get("presentation_number"),
            presentation_unit=validated_data.get("presentation_unit", ""),
            attributes=validated_data.get("variant_attributes") or {},
            cost=validated_data.get("cost", Decimal("0")),
            is_active=validated_data.get("is_active", True),
        )
        Price.objects.create(
            variant=variant,
            amount=validated_data["price"],
            currency="COP",
            valid_from=timezone.now(),
            valid_until=None,
            is_active=True,
        )
        return product
