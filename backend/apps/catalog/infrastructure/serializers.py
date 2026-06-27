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


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = "__all__"


class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = "__all__"
