from datetime import timedelta
from pathlib import Path

from django.db import DatabaseError
from django.utils import timezone
from rest_framework import serializers

from apps.notifications.infrastructure.models import StaffNotification
from shared.domain.exceptions import BusinessRuleViolation

from ..application.use_cases import validate_schedule_change_42_hours

from .models import (
    Attendance,
    AttendanceIntelligenceSettings,
    BiometricDevice,
    BiometricImportBatch,
    CompanyDocument,
    CompanyDocumentVersion,
    EmployeeBiometricId,
    EmployeeDocument,
    EmployeeWorkSchedule,
    EmployeeWorkScheduleDay,
    OvertimeShift,
    Payroll,
    PayrollItem,
    PayrollLegalParameter,
    PayrollPeriod,
    PayslipDocument,
    PerformanceReview,
    PublicHoliday,
    RawBiometricPunch,
    VacationRequest,
    VacationRequestApprovalStep,
    VacationRequestAttachment,
    VacationRequestHistory,
    WorkScheduleTemplate,
    WorkScheduleTemplateDay,
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
    labor_certificate_download_available = serializers.SerializerMethodField()
    labor_certificate_download_expires_at = serializers.SerializerMethodField()

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
            "labor_certificate_download_available",
            "labor_certificate_download_expires_at",
            "admin_decision",
            "admin_decided_by",
            "admin_decided_at",
            "admin_comment",
            "hr_decision",
            "hr_decided_by",
            "hr_decided_at",
            "hr_comment",
            "loan_expense_number",
            "loan_approved_amount",
            "is_remunerated",
            "remuneration_decided_by",
            "remuneration_decided_at",
        )

    def validate(self, attrs):
        instance = self.instance
        request_type = attrs.get("request_type", getattr(instance, "request_type", None))
        subtype = attrs.get("subtype", getattr(instance, "subtype", ""))
        start_date = attrs.get("start_date", getattr(instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(instance, "end_date", None))
        is_full_day = attrs.get("is_full_day", getattr(instance, "is_full_day", True))
        start_time = attrs.get("start_time", getattr(instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(instance, "end_time", None))
        requested_work_schedule_template = attrs.get(
            "requested_work_schedule_template",
            getattr(instance, "requested_work_schedule_template", None),
        )
        requested_work_schedule_days = attrs.get(
            "requested_work_schedule_days",
            getattr(instance, "requested_work_schedule_days", None),
        )

        errors = {}
        is_schedule_change = (
            request_type == VacationRequest.RequestType.SCHEDULE_CHANGE
            or subtype == VacationRequest.RequestSubtype.SCHEDULE_CHANGE
        )
        if request_type == VacationRequest.RequestType.SCHEDULE_CHANGE and not attrs.get("subtype"):
            attrs["subtype"] = VacationRequest.RequestSubtype.SCHEDULE_CHANGE

        if start_date and end_date and end_date < start_date:
            errors["end_date"] = ["La fecha final no puede ser anterior a la fecha inicial."]

        if request_type == VacationRequest.RequestType.LABOR_CERTIFICATE:
            if not str(attrs.get("reason", getattr(instance, "reason", "")) or "").strip():
                errors["reason"] = ["Indica el motivo del certificado laboral."]
            if start_date and end_date and start_date != end_date:
                errors["end_date"] = ["El certificado laboral se solicita para un solo dÃ­a."]
            attrs["is_full_day"] = True
            attrs["end_date"] = start_date or end_date
            attrs["subtype"] = VacationRequest.RequestSubtype.ADMINISTRATIVE
            if start_time is not None:
                errors["start_time"] = ["No se debe enviar hora de inicio para certificado laboral."]
            if end_time is not None:
                errors["end_time"] = ["No se debe enviar hora fin para certificado laboral."]
        elif request_type == VacationRequest.RequestType.LOAN:
            required_loan_fields = {
                "loan_amount": "Indica el monto solicitado.",
                "loan_requester_name": "Indica el nombre del solicitante.",
                "loan_requester_document": "Indica la cédula del solicitante.",
                "loan_city": "Indica la ciudad.",
                "loan_position": "Indica el cargo.",
                "loan_concept": "Indica el concepto del préstamo.",
                "loan_frequency": "Indica si el pago es quincenal o mensual.",
                "loan_installments_count": "Indica el número de cuotas.",
            }
            for field_name, message in required_loan_fields.items():
                value = attrs.get(field_name, getattr(instance, field_name, None))
                if value in (None, ""):
                    errors[field_name] = [message]
            loan_amount = attrs.get("loan_amount", getattr(instance, "loan_amount", None))
            if loan_amount is not None and loan_amount <= 0:
                errors["loan_amount"] = ["El monto debe ser mayor a cero."]
        elif is_schedule_change:
            if not str(attrs.get("reason", getattr(instance, "reason", "")) or "").strip():
                errors["reason"] = ["Indica el motivo del cambio de horario."]
            if requested_work_schedule_days:
                try:
                    normalized_days, _ = validate_schedule_change_42_hours(requested_work_schedule_days)
                    attrs["requested_work_schedule_days"] = normalized_days
                except BusinessRuleViolation as exc:
                    errors["requested_work_schedule_days"] = [str(exc)]
            elif requested_work_schedule_template is None:
                errors["requested_work_schedule_days"] = ["Selecciona el nuevo horario solicitado."]
            if not is_full_day:
                errors["is_full_day"] = ["El cambio de horario se solicita como jornada completa desde la fecha indicada."]
            if start_time is not None:
                errors["start_time"] = ["No se debe enviar hora de inicio en un cambio de horario."]
            if end_time is not None:
                errors["end_time"] = ["No se debe enviar hora fin en un cambio de horario."]
        elif is_full_day:
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
        if self.context.get("include_request_related") is False:
            return []
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
        if obj.request_type != VacationRequest.RequestType.OVERTIME:
            return []
        try:
            related = getattr(obj, "overtime_shifts").all()
            return OvertimeShiftSerializer(related, many=True, context=self.context).data
        except DatabaseError:
            return []

    def get_labor_certificate_download_expires_at(self, obj):
        if obj.request_type != VacationRequest.RequestType.LABOR_CERTIFICATE:
            return None
        if obj.status != VacationRequest.Status.APPROVED:
            return None
        if obj.due_date:
            return obj.due_date.isoformat()
        decided_at = obj.hr_decided_at or obj.reviewed_at
        if not decided_at:
            return None
        return (timezone.localtime(decided_at).date() + timedelta(days=5)).isoformat()

    def get_labor_certificate_download_available(self, obj):
        expires_at = self.get_labor_certificate_download_expires_at(obj)
        if not expires_at:
            return False
        return timezone.localdate().isoformat() <= expires_at

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
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Payroll
        fields = "__all__"
        read_only_fields = (
            "items",
            "employee_name",
            "status",
            "period",
            "payslip_number",
            "worked_days",
            "ordinary_hours",
            "overtime_hours",
            "transport_allowance",
            "health_deduction",
            "pension_deduction",
            "gross_earnings",
            "total_deductions",
            "approved_by",
            "approved_at",
            "paid_at",
            "payment_reference",
            "signature",
        )

    def get_employee_name(self, obj):
        employee = obj.employee
        return f"{employee.first_name} {employee.last_name}".strip() or employee.employee_code


class PayrollPeriodSerializer(serializers.ModelSerializer):
    payrolls = PayrollSerializer(many=True, read_only=True)

    class Meta:
        model = PayrollPeriod
        fields = "__all__"
        read_only_fields = (
            "status", "calculated_at", "calculated_by", "approved_at",
            "approved_by", "paid_at", "paid_by",
        )


class PayslipDocumentSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = PayslipDocument
        fields = "__all__"
        read_only_fields = ("uploaded_by", "published_at", "employee_name", "file_name")

    def get_employee_name(self, obj):
        employee = obj.employee
        return f"{employee.first_name} {employee.last_name}".strip() or employee.employee_code

    def get_file_name(self, obj):
        return Path(obj.file.name).name if obj.file else ""

    def validate_file(self, file):
        if not file:
            return file
        extension = Path(file.name).suffix.lower().lstrip(".")
        if extension != "pdf":
            raise serializers.ValidationError("El volante de pago debe ser un archivo PDF.")
        content_type = getattr(file, "content_type", None)
        if content_type and content_type.lower() != "application/pdf":
            raise serializers.ValidationError("El volante de pago debe ser un archivo PDF.")
        return file

    def validate(self, attrs):
        period_start = attrs.get("period_start", getattr(self.instance, "period_start", None))
        period_end = attrs.get("period_end", getattr(self.instance, "period_end", None))
        if period_start and period_end and period_end < period_start:
            raise serializers.ValidationError({"period_end": "La fecha final debe ser posterior o igual a la fecha inicial."})
        if not self.instance and not attrs.get("file"):
            raise serializers.ValidationError({"file": "Debes adjuntar el PDF del volante de pago."})
        if not str(attrs.get("title", getattr(self.instance, "title", "")) or "").strip():
            raise serializers.ValidationError({"title": "Indica un nombre para el volante de pago."})
        return attrs


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


class CompanyDocumentVersionSerializer(serializers.ModelSerializer):
    version_label = serializers.ReadOnlyField()

    class Meta:
        model = CompanyDocumentVersion
        fields = "__all__"
        read_only_fields = ("document", "version_number", "published_at", "uploaded_by")

    def validate(self, attrs):
        visible_from = attrs.get("visible_from", getattr(self.instance, "visible_from", None))
        visible_until = attrs.get("visible_until", getattr(self.instance, "visible_until", None))
        if visible_from and visible_until and visible_until < visible_from:
            raise serializers.ValidationError(
                {"visible_until": "La fecha final debe ser posterior o igual a la fecha inicial."}
            )
        return attrs

    def validate_file(self, file):
        if not file:
            raise serializers.ValidationError("Debes adjuntar un archivo.")

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


class CompanyDocumentSerializer(serializers.ModelSerializer):
    """``current_version`` es la última versión publicada (para RRHH, que
    gestiona el documento completo) salvo que el contexto marque
    ``visible_only=True`` (vista de empleado), en cuyo caso es la última
    versión publicada que además esté dentro de su ventana de vigencia —
    puede no coincidir con la más reciente si esta aún no entra en vigor o ya
    venció."""

    current_version = serializers.SerializerMethodField()
    versions_count = serializers.IntegerField(source="versions.count", read_only=True)

    class Meta:
        model = CompanyDocument
        fields = "__all__"

    def get_current_version(self, obj):
        if self.context.get("visible_only"):
            version = next((v for v in obj.versions.all() if v.is_currently_visible()), None)
        else:
            version = obj.current_version
        return CompanyDocumentVersionSerializer(version).data if version else None

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Debes indicar el nombre del documento.")
        return value.strip()


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


class PublicHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicHoliday
        fields = "__all__"


class PayrollLegalParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollLegalParameter
        fields = "__all__"


class AttendanceIntelligenceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceIntelligenceSettings
        fields = "__all__"


class WorkScheduleTemplateDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkScheduleTemplateDay
        fields = "__all__"
        read_only_fields = ("template",)


class WorkScheduleTemplateSerializer(serializers.ModelSerializer):
    days = WorkScheduleTemplateDaySerializer(many=True, read_only=True)

    class Meta:
        model = WorkScheduleTemplate
        fields = "__all__"
        read_only_fields = ("created_by",)


class EmployeeWorkScheduleDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeWorkScheduleDay
        fields = "__all__"
        read_only_fields = ("schedule",)


class EmployeeWorkScheduleSerializer(serializers.ModelSerializer):
    days = EmployeeWorkScheduleDaySerializer(many=True, read_only=True)

    class Meta:
        model = EmployeeWorkSchedule
        fields = "__all__"
        read_only_fields = ("created_by", "source_template")


class BiometricDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BiometricDevice
        fields = "__all__"


class EmployeeBiometricIdSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeBiometricId
        fields = "__all__"

    def validate(self, attrs):
        instance = self.instance
        biometric_code = attrs.get("biometric_code", getattr(instance, "biometric_code", None))
        device = attrs.get("device", getattr(instance, "device", None))
        is_active = attrs.get("is_active", getattr(instance, "is_active", True))
        if biometric_code and is_active:
            queryset = EmployeeBiometricId.objects.filter(
                biometric_code=biometric_code,
                is_active=True,
                deleted_at__isnull=True,
            )
            queryset = queryset.filter(device=device) if device else queryset.filter(device__isnull=True)
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            existing = queryset.select_related("employee").first()
            if existing:
                target_employee = attrs.get("employee", getattr(instance, "employee", None))
                if target_employee and existing.employee_id == target_employee.id:
                    message = "Este empleado ya tiene guardado ese mismo código para ese dispositivo."
                else:
                    employee_name = str(existing.employee)
                    message = f"Este código activo ya está asignado a {employee_name} para ese dispositivo."
                raise serializers.ValidationError({
                    "biometric_code": [message],
                })
        return attrs


class RawBiometricPunchSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawBiometricPunch
        fields = "__all__"


class BiometricImportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = BiometricImportBatch
        fields = "__all__"
        read_only_fields = (
            "uploaded_by", "status", "total_rows", "matched_rows",
            "unmatched_rows", "duplicate_rows", "error_log", "processed_at",
        )
