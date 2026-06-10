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
