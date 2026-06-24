from rest_framework import serializers

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

    class Meta:
        model = Customer
        fields = "__all__"
        read_only_fields = ("deleted_at",)


class MyCustomerProfileSerializer(serializers.ModelSerializer):
    """Datos propios del cliente autenticado que viven en el modelo Customer."""

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
        )
        read_only_fields = ("id", "email", "wholesale_code")
