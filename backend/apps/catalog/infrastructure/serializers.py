from decimal import Decimal

from django.db import transaction
from django.db.models import Avg
from django.utils import timezone
from rest_framework import serializers

from apps.promotions.application.services import resolve_best_promotion
from apps.promotions.infrastructure.serializers import PromotionSummarySerializer

from .models import Category, Price, Product, ProductImage, ProductReview, ProductVariant, ProductVariantImage


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class PriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Price
        fields = "__all__"


def _get_current_price_amount(variant) -> Decimal | None:
    """Replica el criterio del frontend (products.service.ts: getCurrentPrice):
    el primer precio con is_active=True, o el primero de la lista como fallback."""
    prices = getattr(variant, "_prefetched_active_prices", None)
    if prices is None:
        prices = list(variant.prices.all())
    if not prices:
        return None
    active = next((p for p in prices if p.is_active), prices[0])
    return active.amount


MAX_IMAGES_PER_VARIANT = 3


class ProductVariantImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariantImage
        fields = "__all__"

    def validate_variant(self, variant):
        existing = variant.images.exclude(pk=getattr(self.instance, "pk", None))
        if existing.count() >= MAX_IMAGES_PER_VARIANT:
            raise serializers.ValidationError(
                f"Una variante no puede tener más de {MAX_IMAGES_PER_VARIANT} imágenes."
            )
        return variant


class ProductVariantSerializer(serializers.ModelSerializer):
    prices = PriceSerializer(many=True, read_only=True)
    images = ProductVariantImageSerializer(many=True, read_only=True)
    presentation_label = serializers.CharField(read_only=True)
    available_quantity = serializers.SerializerMethodField()
    minimum_quantity = serializers.SerializerMethodField()
    active_promotion = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()

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

    def _resolve_promotion(self, obj):
        amount = _get_current_price_amount(obj)
        return resolve_best_promotion(obj, amount)

    def get_active_promotion(self, obj):
        resolution = self._resolve_promotion(obj)
        if resolution is None:
            return None
        return PromotionSummarySerializer(resolution.promotion).data

    def get_discounted_price(self, obj):
        resolution = self._resolve_promotion(obj)
        if resolution is None:
            return None
        return resolution.discounted_amount

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


class ProductReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = ("id", "product", "user", "user_name", "rating", "comment", "created_at", "updated_at")
        read_only_fields = ("user",)

    def get_user_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.email.split("@")[0]

    def validate(self, attrs):
        request = self.context.get("request")
        product = attrs.get("product") or getattr(self.instance, "product", None)
        if request and not self.instance:
            if ProductReview.objects.filter(product=product, user=request.user).exists():
                raise serializers.ValidationError("Ya has escrito una reseña para este producto.")
        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    rating_average = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    active_promotion = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = "__all__"

    def get_rating_average(self, obj):
        result = obj.reviews.aggregate(avg=Avg("rating"))["avg"]
        return round(result, 1) if result is not None else None

    def get_rating_count(self, obj):
        return obj.reviews.count()

    def get_active_promotion(self, obj):
        """La mejor promoción activa entre las de sus variantes, usada para el
        badge de catálogo cuando aún no se ha seleccionado una variante."""
        best = None
        for variant in obj.variants.all():
            resolution = resolve_best_promotion(variant, _get_current_price_amount(variant))
            if resolution is None:
                continue
            if best is None or resolution.promotion.discount_value > best.promotion.discount_value:
                best = resolution
        return PromotionSummarySerializer(best.promotion).data if best else None


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
