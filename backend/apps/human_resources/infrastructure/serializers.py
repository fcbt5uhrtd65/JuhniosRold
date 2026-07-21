from pathlib import Path

from django.db import DatabaseError
from rest_framework import serializers

from apps.notifications.infrastructure.models import StaffNotification

from .models import (
    Attendance,
    EmployeeDocument,
    OvertimeShift,
    Payroll,
    PayrollItem,
    PerformanceReview,
    VacationRequest,
    VacationRequestApprovalStep,
    VacationRequestAttachment,
    VacationRequestHistory,
)

ALLOWED_SUPPORT_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
}


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "__all__"


class VacationRequestAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequestAttachment
        fields = "__all__"
        read_only_fields = ("uploaded_by",)

    def validate_file(self, file):
        if not file:
            return file
        extension = Path(file.name).suffix.lower().lstrip(".")
        if extension not in {"pdf", "png", "jpg", "jpeg", "doc", "docx"}:
            raise serializers.ValidationError(
                "El adjunto solo puede ser PDF, Word o una imagen PNG/JPG."
            )
        return file


class VacationRequestApprovalStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequestApprovalStep
        fields = "__all__"


class VacationRequestHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequestHistory
        fields = "__all__"


class OvertimeShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = OvertimeShift
        fields = "__all__"
        read_only_fields = ("request", "hours_count")

    def validate(self, attrs):
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({"end_time": ["La hora final debe ser posterior a la hora inicial."]})
        return attrs


class VacationRequestSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(read_only=True)
    attachments = serializers.SerializerMethodField()
    approval_steps = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    overtime_shifts = serializers.SerializerMethodField()

    class Meta:
        model = VacationRequest
        fields = "__all__"
        read_only_fields = (
            "request_number",
            "status",
            "reviewed_by",
            "reviewed_at",
            "employee",
            "attachments",
            "approval_steps",
            "history",
            "overtime_shifts",
            "admin_decision",
            "admin_decided_by",
            "admin_decided_at",
            "admin_comment",
            "hr_decision",
            "hr_decided_by",
            "hr_decided_at",
            "hr_comment",
        )

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

    def _serialize_related(self, obj, related_name, serializer_class):
        try:
            related = getattr(obj, related_name).all()
            return serializer_class(related, many=True, context=self.context).data
        except DatabaseError:
            return []

    def get_attachments(self, obj):
        return self._serialize_related(obj, "attachments", VacationRequestAttachmentSerializer)

    def get_approval_steps(self, obj):
        return self._serialize_related(obj, "approval_steps", VacationRequestApprovalStepSerializer)

    def get_history(self, obj):
        return self._serialize_related(obj, "history", VacationRequestHistorySerializer)

    def get_overtime_shifts(self, obj):
        return self._serialize_related(obj, "overtime_shifts", OvertimeShiftSerializer)

    def validate_support_document(self, file):
        if not file:
            return file

        extension = Path(file.name).suffix.lower().lstrip(".")
        if extension not in {"pdf", "png", "jpg", "jpeg"}:
            raise serializers.ValidationError(
                "El documento de soporte solo puede ser PDF o una imagen PNG/JPG."
            )

        content_type = getattr(file, "content_type", None)
        if content_type and content_type.lower() not in ALLOWED_SUPPORT_CONTENT_TYPES:
            raise serializers.ValidationError(
                "El documento de soporte solo puede ser PDF o una imagen PNG/JPG."
            )

        return file


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
        read_only_fields = ("uploaded_at", "uploaded_by")

    def validate_file(self, file):
        if not file:
            return file

        extension = Path(file.name).suffix.lower().lstrip(".")
        if extension not in {"pdf", "png", "jpg", "jpeg", "doc", "docx"}:
            raise serializers.ValidationError(
                "El documento solo puede ser PDF, Word o una imagen PNG/JPG."
            )

        content_type = getattr(file, "content_type", None)
        if content_type and content_type.lower() not in {
            *ALLOWED_SUPPORT_CONTENT_TYPES,
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }:
            raise serializers.ValidationError(
                "El documento solo puede ser PDF, Word o una imagen PNG/JPG."
            )

        return file


class EmployeeSelfServiceDocumentSerializer(serializers.ModelSerializer):
    """Restricted variant for an employee uploading their own supporting documents.

    Only the file/type/name/dates are writable — status, employee, and uploaded_by
    stay controlled server-side so an employee can't self-approve or spoof ownership.
    """

    class Meta:
        model = EmployeeDocument
        fields = "__all__"
        read_only_fields = ("uploaded_at", "uploaded_by", "employee", "status")

    validate_file = EmployeeDocumentSerializer.validate_file


class HRNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffNotification
        fields = "__all__"
