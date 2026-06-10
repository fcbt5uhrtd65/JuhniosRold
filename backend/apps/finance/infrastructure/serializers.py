from rest_framework import serializers

from .models import FinancialTransaction


class FinancialTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialTransaction
        fields = "__all__"
        read_only_fields = ("created_by",)
