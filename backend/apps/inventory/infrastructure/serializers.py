from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from apps.catalog.infrastructure.models import Category, Price, Product, ProductVariant

from ..application.use_cases import RegisterInventoryMovement
from .models import (
    Formula,
    FormulaLine,
    InventoryMovement,
    Item,
    ItemGroup,
    ItemType,
    Location,
    ProductionOrder,
    PurchaseOrder,
    PurchaseOrderLine,
    Stock,
    StockConversion,
    Supplier,
    UnitOfMeasure,
    Warehouse,
)


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = "__all__"


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = "__all__"


class StockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = "__all__"
        read_only_fields = ("quantity",)


class InventoryMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryMovement
        fields = "__all__"
        read_only_fields = ("created_by",)

    def create(self, validated_data):
        request = self.context["request"]
        return RegisterInventoryMovement().execute(
            **validated_data,
            actor=request.user if request.user.is_authenticated else None,
        )


# ── Maestros ────────────────────────────────────────────────────────────────

class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = "__all__"


class ItemGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemGroup
        fields = "__all__"


class ItemTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemType
        fields = "__all__"


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"


RAW_MATERIAL_CATEGORY_SLUG = "materias-primas"
RAW_MATERIAL_CATEGORY_NAME = "Materias primas"
RAW_MATERIAL_ATTR_KEY = "inventory_item_type"
RAW_MATERIAL_ATTR_VALUE = "raw_material"


def _normalize_text(value):
    return str(value or "").strip().lower()


def _is_raw_material(item):
    text = " ".join(
        [
            _normalize_text(getattr(getattr(item, "item_type", None), "name", "")),
            _normalize_text(getattr(getattr(item, "item_group", None), "name", "")),
        ]
    )
    return any(keyword in text for keyword in ("materia prima", "fragancia", "colorante", "extracto"))


def _presentation_unit(item):
    unit_text = _normalize_text(
        " ".join(
            [
                getattr(getattr(item, "unit", None), "abbreviation", ""),
                getattr(getattr(item, "unit", None), "name", ""),
            ]
        )
    )
    if "kg" in unit_text or "kilo" in unit_text:
        return ProductVariant.PresentationUnit.KG
    if "gr" in unit_text or unit_text == "g" or "gram" in unit_text:
        return ProductVariant.PresentationUnit.GR
    if "ml" in unit_text or "mililit" in unit_text:
        return ProductVariant.PresentationUnit.ML
    if "lt" in unit_text or unit_text == "l" or "litro" in unit_text:
        return ProductVariant.PresentationUnit.LT
    return ProductVariant.PresentationUnit.UND


def _unique_slug(base):
    seed = slugify(base)[:44] or "materia-prima"
    slug = seed
    suffix = 2
    while Product.objects.filter(slug=slug).exists():
        slug = f"{seed[:44 - len(str(suffix)) - 1]}-{suffix}"
        suffix += 1
    return slug


def _unique_sku(item, variant=None):
    base = f"MP-{item.code}".upper()[:72]
    sku = base
    suffix = 2
    queryset = ProductVariant.objects.all()
    if variant is not None:
        queryset = queryset.exclude(pk=variant.pk)
    while queryset.filter(sku=sku).exists():
        suffix_text = f"-{suffix}"
        sku = f"{base[:80 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    return sku


@transaction.atomic
def sync_raw_material_product(item):
    """Keep an inventory raw material purchasable through the normal cart.

    Raw materials are authored in Inventory/Admin as Item records, but commerce
    only accepts ProductVariant lines. This bridge creates a hidden catalog
    product/variant linked through Item.product_variant and keeps price, image
    and active state synchronized.
    """
    item = Item.objects.select_related("item_type", "item_group", "unit").get(pk=item.pk)
    if not _is_raw_material(item):
        return item

    category, _ = Category.objects.get_or_create(
        slug=RAW_MATERIAL_CATEGORY_SLUG,
        defaults={"name": RAW_MATERIAL_CATEGORY_NAME, "is_active": True},
    )
    if not category.is_active:
        category.is_active = True
        category.save(update_fields=("is_active", "updated_at"))

    variant = item.product_variant
    product = getattr(variant, "product", None) if variant else None
    if product is None:
        product = Product.objects.create(
            category=category,
            name=item.name,
            slug=_unique_slug(f"materia-prima-{item.code}-{item.name}"),
            description=item.description,
            image_url=item.image_url,
            is_active=item.is_active,
            is_featured=False,
        )
        variant = ProductVariant.objects.create(
            product=product,
            sku=_unique_sku(item),
            name=f"1 {getattr(item.unit, 'abbreviation', '') or 'unidad'}",
            presentation_number=Decimal("1"),
            presentation_unit=_presentation_unit(item),
            image_url=item.image_url,
            attributes={RAW_MATERIAL_ATTR_KEY: RAW_MATERIAL_ATTR_VALUE, "inventory_item_id": str(item.id)},
            cost=item.cost,
            is_active=item.is_active,
        )
        item.product_variant = variant
        item.save(update_fields=("product_variant", "updated_at"))
    else:
        attributes = dict(variant.attributes or {})
        attributes[RAW_MATERIAL_ATTR_KEY] = RAW_MATERIAL_ATTR_VALUE
        attributes["inventory_item_id"] = str(item.id)
        product.category = category
        product.name = item.name
        product.description = item.description
        product.image_url = item.image_url
        product.is_active = item.is_active
        product.is_featured = False
        product.save(update_fields=("category", "name", "description", "image_url", "is_active", "is_featured", "updated_at"))

        variant.sku = _unique_sku(item, variant)
        variant.name = f"1 {getattr(item.unit, 'abbreviation', '') or 'unidad'}"
        variant.presentation_number = Decimal("1")
        variant.presentation_unit = _presentation_unit(item)
        variant.image_url = item.image_url
        variant.attributes = attributes
        variant.cost = item.cost
        variant.is_active = item.is_active
        variant.save(
            update_fields=(
                "sku",
                "name",
                "presentation_number",
                "presentation_unit",
                "image_url",
                "attributes",
                "cost",
                "is_active",
                "updated_at",
            )
        )

    price = variant.prices.filter(is_active=True).order_by("-valid_from").first()
    if price:
        price.amount = item.cost
        price.currency = "COP"
        price.valid_until = None
        price.save(update_fields=("amount", "currency", "valid_until", "updated_at"))
    else:
        Price.objects.create(
            variant=variant,
            amount=item.cost,
            currency="COP",
            valid_from=timezone.now(),
            valid_until=None,
            is_active=True,
        )
    return item


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = "__all__"

    @transaction.atomic
    def create(self, validated_data):
        item = super().create(validated_data)
        return sync_raw_material_product(item)

    @transaction.atomic
    def update(self, instance, validated_data):
        item = super().update(instance, validated_data)
        return sync_raw_material_product(item)


class PublicRawMaterialSerializer(serializers.ModelSerializer):
    item_type_name = serializers.CharField(source="item_type.name", read_only=True)
    item_group_name = serializers.CharField(source="item_group.name", read_only=True)
    unit_name = serializers.CharField(source="unit.name", read_only=True)
    unit_abbreviation = serializers.CharField(source="unit.abbreviation", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, allow_null=True)
    variant_id = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    presentation = serializers.SerializerMethodField()
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = (
            "id",
            "variant_id",
            "code",
            "name",
            "description",
            "image_url",
            "cost",
            "price",
            "currency",
            "presentation",
            "available_quantity",
            "minimum_quantity",
            "maximum_quantity",
            "tracks_batches",
            "item_type_name",
            "item_group_name",
            "unit_name",
            "unit_abbreviation",
            "supplier_name",
            "created_at",
            "updated_at",
        )

    def _variant(self, item):
        if not item.product_variant_id:
            sync_raw_material_product(item)
            item.refresh_from_db(fields=("product_variant",))
        return item.product_variant

    def _active_price(self, item):
        variant = self._variant(item)
        return variant.prices.filter(is_active=True).order_by("-valid_from").first() if variant else None

    def get_variant_id(self, item):
        variant = self._variant(item)
        return variant.id if variant else None

    def get_price(self, item):
        price = self._active_price(item)
        return price.amount if price else item.cost

    def get_currency(self, item):
        price = self._active_price(item)
        return price.currency if price else "COP"

    def get_presentation(self, item):
        variant = self._variant(item)
        return variant.presentation_label if variant else f"1 {item.unit.abbreviation or 'unidad'}"

    def get_available_quantity(self, item):
        variant = self._variant(item)
        if not variant:
            return None
        stock = variant.stocks.order_by("id").first()
        return float(stock.available_quantity) if stock else None


# ── Compras ─────────────────────────────────────────────────────────────────

class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderLine
        fields = ("id", "item", "quantity", "unit_price", "received_quantity")


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseOrderLineSerializer(many=True, required=False)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = (
            "id",
            "number",
            "supplier",
            "status",
            "issued_at",
            "expected_at",
            "destination_location",
            "notes",
            "created_by",
            "total",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("number", "created_by")

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        order = PurchaseOrder.objects.create(**validated_data)
        PurchaseOrderLine.objects.bulk_create(
            PurchaseOrderLine(order=order, **line) for line in lines_data
        )
        return order


# ── Producción ──────────────────────────────────────────────────────────────

class FormulaLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormulaLine
        fields = ("id", "item", "quantity")


class FormulaSerializer(serializers.ModelSerializer):
    lines = FormulaLineSerializer(many=True, required=False)

    class Meta:
        model = Formula
        fields = (
            "id",
            "code",
            "name",
            "output_item",
            "yield_quantity",
            "yield_unit",
            "is_active",
            "lines",
        )

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        formula = Formula.objects.create(**validated_data)
        FormulaLine.objects.bulk_create(
            FormulaLine(formula=formula, **line) for line in lines_data
        )
        return formula


class ProductionOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionOrder
        fields = "__all__"
        read_only_fields = ("number",)


# ── Conversión ────────────────────────────────────────────────────────────

class StockConversionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockConversion
        fields = "__all__"
        read_only_fields = ("number", "created_by")

    def create(self, validated_data):
        request = self.context["request"]
        validated_data["created_by"] = request.user if request.user.is_authenticated else None
        return super().create(validated_data)
