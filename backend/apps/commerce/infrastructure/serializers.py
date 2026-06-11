from decimal import Decimal

from rest_framework import serializers

from .models import Cart, CartItem, Order, OrderItem, OrderStatusHistory, Payment


class CartItemSerializer(serializers.ModelSerializer):
    variant_id = serializers.UUIDField(source="variant.id", read_only=True)
    product_name = serializers.CharField(source="variant.product.name", read_only=True)
    sku = serializers.CharField(source="variant.sku", read_only=True)
    presentation = serializers.CharField(source="variant.name", read_only=True)
    category = serializers.CharField(
        source="variant.product.category.name",
        read_only=True,
    )
    unit_price = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = (
            "id",
            "variant_id",
            "product_name",
            "sku",
            "presentation",
            "category",
            "unit_price",
            "currency",
            "image_url",
            "quantity",
            "subtotal",
            "created_at",
            "updated_at",
        )

    @staticmethod
    def _price(item):
        return item.variant.prices.filter(is_active=True).order_by("-valid_from").first()

    def get_unit_price(self, item):
        price = self._price(item)
        return price.amount if price else None

    def get_currency(self, item):
        price = self._price(item)
        return price.currency if price else "COP"

    def get_image_url(self, item):
        product = item.variant.product
        primary = next((image for image in product.images.all() if image.is_primary), None)
        return primary.image.url if primary else product.image_url

    def get_subtotal(self, item):
        price = self._price(item)
        return price.amount * item.quantity if price else None


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ("id", "items", "subtotal", "item_count", "created_at", "updated_at")

    def get_subtotal(self, cart):
        total = Decimal("0")
        for item in cart.items.all():
            price = CartItemSerializer._price(item)
            if price:
                total += price.amount * item.quantity
        return total

    def get_item_count(self, cart):
        return sum(item.quantity for item in cart.items.all())


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = "__all__"


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id",
            "provider",
            "reference",
            "amount_in_cents",
            "currency",
            "status",
            "payment_method",
            "provider_transaction_id",
            "created_at",
            "updated_at",
        )


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = "__all__"
        read_only_fields = (
            "number",
            "subtotal",
            "shipping_cost",
            "total",
            "payment_reference",
            "inventory_reserved_at",
            "inventory_consumed_at",
            "inventory_released_at",
        )

    def validate_status(self, value):
        payment_managed_statuses = {
            Order.Status.PAYMENT_PENDING,
            Order.Status.PAID,
            Order.Status.FAILED,
        }
        if value in payment_managed_statuses:
            raise serializers.ValidationError(
                "Este estado solo puede ser actualizado por el flujo de pagos."
            )
        return value


class CheckoutSerializer(serializers.Serializer):
    location_id = serializers.UUIDField(required=False)
    shipping_address = serializers.CharField()


class AddCartItemSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField()
    quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )


class DirectCheckoutItemSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField()
    quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )


class DirectCheckoutSerializer(serializers.Serializer):
    items = DirectCheckoutItemSerializer(many=True, allow_empty=False)
    shipping_address = serializers.CharField()
    location_id = serializers.UUIDField(required=False)


class InitiateWompiPaymentSerializer(serializers.Serializer):
    order_id = serializers.UUIDField(required=False)
    pedido_id = serializers.UUIDField(required=False, write_only=True)

    def validate(self, attrs):
        order_id = attrs.get("order_id") or attrs.get("pedido_id")
        if not order_id:
            raise serializers.ValidationError(
                {"pedido_id": "Debes enviar pedido_id u order_id."}
            )
        attrs["order_id"] = order_id
        return attrs


class PaymentStartResponseSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=("mock", "wompi"))
    payment_id = serializers.UUIDField()
    requires_redirect = serializers.BooleanField()
    checkout_url = serializers.URLField(allow_blank=True)
    reference = serializers.CharField()
    amount_in_cents = serializers.IntegerField()
    currency = serializers.CharField()
    public_key = serializers.CharField(allow_blank=True)
    integrity_signature = serializers.CharField(allow_blank=True)
    redirect_url = serializers.URLField(allow_blank=True)


class ResolveMockPaymentSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=("approved", "declined"))


class WompiWebhookSerializer(serializers.Serializer):
    event = serializers.CharField()
    data = serializers.DictField()
    environment = serializers.CharField()
    signature = serializers.DictField()
    timestamp = serializers.IntegerField()
    sent_at = serializers.DateTimeField(required=False)


class WompiPaymentStatusSerializer(serializers.Serializer):
    order_id = serializers.UUIDField()
    order_status = serializers.CharField()
    payment_status = serializers.CharField(allow_null=True)
    provider = serializers.CharField(allow_blank=True)
    payment_method = serializers.CharField(allow_blank=True)
    transaction_id = serializers.CharField(allow_blank=True)
    invoice_number = serializers.CharField(allow_blank=True)
