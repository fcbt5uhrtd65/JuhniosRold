from rest_framework import serializers

from .models import Attendance, EmployeeDocument, Payroll, PayrollItem, PerformanceReview, VacationRequest


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "__all__"


class VacationRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequest
        fields = "__all__"
        read_only_fields = ("status", "reviewed_by", "reviewed_at")


class PayrollItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollItem
        fields = "__all__"


class PayrollSerializer(serializers.ModelSerializer):
    items = PayrollItemSerializer(many=True, read_only=True)

    class Meta:
        model = Payroll
        fields = "__all__"


class PerformanceReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceReview
        fields = "__all__"


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = "__all__"
