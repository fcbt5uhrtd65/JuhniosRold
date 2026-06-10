from rest_framework import serializers

from .models import Department, Employee, EmploymentContract, Position


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = "__all__"


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentContract
        fields = "__all__"


class EmployeeSerializer(serializers.ModelSerializer):
    contracts = ContractSerializer(many=True, read_only=True)

    class Meta:
        model = Employee
        fields = "__all__"
