from rest_framework import serializers
from django.db.models import Sum, Max, Q

from .models import Customer, CustomerContact, CustomerSegment


class CustomerSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerSegment
        fields = "__all__"


class CustomerContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerContact
        fields = "__all__"


class CustomerSerializer(serializers.ModelSerializer):
    contacts = CustomerContactSerializer(many=True, read_only=True)
    total_compras = serializers.SerializerMethodField()
    ultima_compra = serializers.SerializerMethodField()

    def get_total_compras(self, obj):
        result = obj.orders.filter(
            ~Q(status='CANCELLED')
        ).aggregate(total=Sum('total'))
        return float(result['total'] or 0)

    def get_ultima_compra(self, obj):
        result = obj.orders.filter(
            ~Q(status='CANCELLED')
        ).aggregate(ultima=Max('created_at'))
        dt = result['ultima']
        return dt.isoformat() if dt else None

    class Meta:
        model = Customer
        fields = "__all__"
        read_only_fields = ("deleted_at",)


class MyCustomerProfileSerializer(serializers.ModelSerializer):
    """Datos propios del cliente autenticado que viven en el modelo Customer."""

    # Declare explicitly to suppress the auto-generated UniqueValidator that
    # DRF adds for unique=True fields — it doesn't exclude the current instance
    # in partial updates. We handle uniqueness manually in validate_document_number.
    document_number = serializers.CharField(required=False, allow_blank=True)

    def validate_document_number(self, value):
        if not value:
            return value
        qs = Customer.objects.filter(document_number__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("El número de documento ya se encuentra registrado.")
        return value

    class Meta:
        model = Customer
        fields = (
            "id",
            "document_type",
            "document_number",
            "first_name",
            "last_name",
            "email",
            "phone",
            "address",
            "city",
            "purchase_mode",
            "wholesale_code",
            "company_id_type",
            "company_id_type_other",
            "company_id_number",
            "company_name",
            "business_type",
            "is_international_distributor",
            "company_phone",
        )
        read_only_fields = ("id", "email", "wholesale_code")
