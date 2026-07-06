from django.core.validators import FileExtensionValidator
from django.conf import settings
from django.db import models
from django.utils import timezone

from shared.infrastructure.models import BaseModel


class Attendance(BaseModel):
    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("employee", "date"), name="unique_attendance_per_employee_day")
        ]


class VacationRequest(BaseModel):
    class RequestType(models.TextChoices):
        PERMISSION = "PERMISSION", "Permiso"
        OVERTIME = "OVERTIME", "Horas extras"
        LEAVE = "LEAVE", "Licencia"
        INCAPACITY = "INCAPACITY", "Incapacidad"
        VACATION = "VACATION", "Vacaciones"
        OTHER = "OTHER", "Otro"

    class RequestSubtype(models.TextChoices):
        PERSONAL = "PERSONAL", "Personal"
        MEDICAL = "MEDICAL", "Médico"
        ACADEMIC = "ACADEMIC", "Académico"
        FAMILY = "FAMILY", "Familiar"
        DAYTIME = "DAYTIME", "Diurnas"
        NIGHT = "NIGHT", "Nocturnas"
        SUNDAY = "SUNDAY", "Dominicales"
        HOLIDAY = "HOLIDAY", "Festivas"
        MATERNITY = "MATERNITY", "Maternidad"
        PATERNITY = "PATERNITY", "Paternidad"
        BEREAVEMENT = "BEREAVEMENT", "Luto"
        MARRIAGE = "MARRIAGE", "Matrimonio"
        DOMESTIC_CALAMITY = "DOMESTIC_CALAMITY", "Calamidad doméstica"
        UNPAID = "UNPAID", "No remunerada"
        GENERAL_ILLNESS = "GENERAL_ILLNESS", "Enfermedad general"
        WORK_ACCIDENT = "WORK_ACCIDENT", "Accidente laboral"
        COMMON_ACCIDENT = "COMMON_ACCIDENT", "Accidente común"
        OCCUPATIONAL_DISEASE = "OCCUPATIONAL_DISEASE", "Enfermedad laboral"
        INDIVIDUAL = "INDIVIDUAL", "Individuales"
        COLLECTIVE = "COLLECTIVE", "Colectivas"
        SHIFT_CHANGE = "SHIFT_CHANGE", "Cambio de turno"
        SCHEDULE_CHANGE = "SCHEDULE_CHANGE", "Cambio de horario"
        ADMINISTRATIVE = "ADMINISTRATIVE", "Solicitud administrativa"
        OTHER = "OTHER", "Otro"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        IN_REVIEW = "IN_REVIEW", "En revisión"
        PENDING_HR = "PENDING_HR", "Pendiente por Recursos Humanos"
        PENDING_ADMIN = "PENDING_ADMIN", "Pendiente por Administrador"
        APPROVED = "APPROVED", "Aprobada"
        REJECTED = "REJECTED", "Rechazada"
        CANCELLED = "CANCELLED", "Cancelada"
        FINALIZED = "FINALIZED", "Finalizada"
        EXPIRED = "EXPIRED", "Vencida"

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="vacations")
    request_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    request_type = models.CharField(max_length=20, choices=RequestType.choices, default=RequestType.VACATION)
    subtype = models.CharField(max_length=40, choices=RequestSubtype.choices, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_full_day = models.BooleanField(default=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    days_count = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    hours_count = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    reason = models.TextField(blank=True)
    description = models.TextField(blank=True)
    observations = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    support_document = models.FileField(
        upload_to="hr/vacations/support/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg"))],
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    admin_decision = models.CharField(max_length=20, choices=Status.choices, blank=True)
    admin_decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_admin_decisions",
    )
    admin_decided_at = models.DateTimeField(null=True, blank=True)
    admin_comment = models.TextField(blank=True)

    hr_decision = models.CharField(max_length=20, choices=Status.choices, blank=True)
    hr_decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_rrhh_decisions",
    )
    hr_decided_at = models.DateTimeField(null=True, blank=True)
    hr_comment = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.request_number:
            self.request_number = self.generate_request_number()
        if self.start_date and self.end_date and not self.days_count:
            self.days_count = max((self.end_date - self.start_date).days + 1, 0)
        super().save(*args, **kwargs)

    @classmethod
    def generate_request_number(cls):
        prefix = f"SOL-{timezone.localdate():%Y%m}"
        next_number = cls.all_objects.filter(request_number__startswith=prefix).count() + 1
        while True:
            number = f"{prefix}-{next_number:04d}"
            if not cls.all_objects.filter(request_number=number).exists():
                return number
            next_number += 1

    def __str__(self):
        return self.request_number or str(self.id)


class VacationRequestAttachment(BaseModel):
    class AttachmentType(models.TextChoices):
        CERTIFICATE = "CERTIFICATE", "Certificado"
        INCAPACITY = "INCAPACITY", "Incapacidad"
        MEDICAL_SUPPORT = "MEDICAL_SUPPORT", "Soporte médico"
        ADDITIONAL = "ADDITIONAL", "Documento adicional"

    request = models.ForeignKey(VacationRequest, on_delete=models.CASCADE, related_name="attachments")
    attachment_type = models.CharField(max_length=30, choices=AttachmentType.choices, default=AttachmentType.ADDITIONAL)
    name = models.CharField(max_length=180)
    file = models.FileField(
        upload_to="hr/requests/attachments/",
        validators=[FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg", "doc", "docx"))],
    )
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)


class VacationRequestApprovalStep(BaseModel):
    class Step(models.TextChoices):
        REQUESTER = "REQUESTER", "Solicitante"
        MANAGER = "MANAGER", "Jefe inmediato"
        HR = "HR", "RRHH"
        FINAL = "FINAL", "Aprobación final"

    request = models.ForeignKey(VacationRequest, on_delete=models.CASCADE, related_name="approval_steps")
    step = models.CharField(max_length=20, choices=Step.choices)
    sequence = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=20, choices=VacationRequest.Status.choices, default=VacationRequest.Status.PENDING)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("sequence", "created_at")
        constraints = [
            models.UniqueConstraint(fields=("request", "step"), name="unique_request_approval_step")
        ]


class VacationRequestHistory(BaseModel):
    class Action(models.TextChoices):
        CREATED = "CREATED", "Creación"
        UPDATED = "UPDATED", "Cambio"
        APPROVED = "APPROVED", "Aprobación"
        REJECTED = "REJECTED", "Rechazo"
        COMMENTED = "COMMENTED", "Comentario"

    request = models.ForeignKey(VacationRequest, on_delete=models.CASCADE, related_name="history")
    action = models.CharField(max_length=20, choices=Action.choices)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20, blank=True)
    comment = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


class Payroll(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        APPROVED = "APPROVED", "Aprobada"
        PAID = "PAID", "Pagada"

    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="payrolls")
    period_start = models.DateField()
    period_end = models.DateField()
    base_salary = models.DecimalField(max_digits=14, decimal_places=2)
    bonuses = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)


class PayrollItem(BaseModel):
    class Type(models.TextChoices):
        EARNING = "EARNING", "Devengado"
        DEDUCTION = "DEDUCTION", "Deducción"

    payroll = models.ForeignKey(Payroll, on_delete=models.CASCADE, related_name="items")
    item_type = models.CharField(max_length=20, choices=Type.choices)
    concept = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=14, decimal_places=2)


class PerformanceReview(BaseModel):
    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="performance_reviews")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    review_date = models.DateField()
    score = models.DecimalField(max_digits=5, decimal_places=2)
    comments = models.TextField(blank=True)


class EmployeeDocument(BaseModel):
    class DocumentType(models.TextChoices):
        ID_COPY = "ID_COPY", "Copia de cédula"
        RESUME = "RESUME", "Hoja de vida con soportes"
        SIGNED_CONTRACT = "SIGNED_CONTRACT", "Contrato firmado"
        BANK_CERTIFICATE = "BANK_CERTIFICATE", "Certificado bancario"
        EPS_CERTIFICATE = "EPS_CERTIFICATE", "Certificado EPS"
        PENSION_CERTIFICATE = "PENSION_CERTIFICATE", "Certificado de pensión"
        SEVERANCE_CERTIFICATE = "SEVERANCE_CERTIFICATE", "Certificado de cesantías"
        ARL_CERTIFICATE = "ARL_CERTIFICATE", "Certificado ARL"
        COMPENSATION_CERTIFICATE = "COMPENSATION_CERTIFICATE", "Certificado Caja de Compensación"
        WORK_CERTIFICATE = "WORK_CERTIFICATE", "Certificados laborales"
        OTHER = "OTHER", "Otros documentos"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        LOADED = "LOADED", "Cargado"
        REJECTED = "REJECTED", "Rechazado"
        EXPIRED = "EXPIRED", "Vencido"
        NOT_APPLICABLE = "NOT_APPLICABLE", "No aplica"

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=100, choices=DocumentType.choices)
    name = models.CharField(max_length=180)
    file = models.FileField(
        upload_to="employees/documents/",
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg", "doc", "docx"))],
    )
    issued_at = models.DateField(null=True, blank=True)
    expires_at = models.DateField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    observations = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_employee_documents",
    )

    def save(self, *args, **kwargs):
        if self.status != self.Status.NOT_APPLICABLE:
            if self.expires_at and self.expires_at < timezone.localdate():
                self.status = self.Status.EXPIRED
            elif self.file and self.status == self.Status.PENDING:
                self.status = self.Status.LOADED
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.get_document_type_display()}"


class HRNotification(BaseModel):
    class NotificationType(models.TextChoices):
        DOCUMENT_EXPIRED = "DOCUMENT_EXPIRED", "Documento vencido"
        DOCUMENT_EXPIRING = "DOCUMENT_EXPIRING", "Documento por vencer"
        MISSING_DOCUMENT = "MISSING_DOCUMENT", "Documento pendiente"
        GENERAL = "GENERAL", "General"

    class Status(models.TextChoices):
        UNREAD = "UNREAD", "Sin leer"
        READ = "READ", "Leída"
        DISMISSED = "DISMISSED", "Descartada"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="hr_notifications",
        null=True,
        blank=True,
    )
    document = models.ForeignKey(
        EmployeeDocument,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=180)
    message = models.TextField()
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNREAD)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_hr_notifications",
    )

    def __str__(self):
        return self.title
