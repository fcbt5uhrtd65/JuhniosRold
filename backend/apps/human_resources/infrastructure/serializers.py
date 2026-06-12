from rest_framework import serializers

from .models import Attendance, EmployeeDocument, Payroll, PayrollItem, PerformanceReview, VacationRequest


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "__all__"


class VacationRequestSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = VacationRequest
        fields = "__all__"
        read_only_fields = ("status", "reviewed_by", "reviewed_at", "employee")

    def validate(self, attrs):
        instance = self.instance
        start_date = attrs.get("start_date", getattr(instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(instance, "end_date", None))
        is_full_day = attrs.get("is_full_day", getattr(instance, "is_full_day", True))
        start_time = attrs.get("start_time", getattr(instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(instance, "end_time", None))

        errors = {}

        if start_date and end_date and end_date < start_date:
            errors["end_date"] = ["La fecha final no puede ser anterior a la fecha inicial."]

        if is_full_day:
            if start_time is not None:
                errors["start_time"] = ["No se debe enviar hora de inicio cuando la solicitud es de jornada completa."]
            if end_time is not None:
                errors["end_time"] = ["No se debe enviar hora fin cuando la solicitud es de jornada completa."]
        else:
            if start_time is None:
                errors["start_time"] = ["Debes indicar la hora de inicio."]
            if start_time is not None and end_time is not None and end_time <= start_time:
                errors["end_time"] = ["La hora final debe ser posterior a la hora inicial."]

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


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
