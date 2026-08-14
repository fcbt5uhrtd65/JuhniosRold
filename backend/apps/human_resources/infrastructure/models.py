from decimal import Decimal

from django.core.validators import FileExtensionValidator
from django.conf import settings
from django.db import models
from django.utils import timezone

from shared.infrastructure.models import BaseModel


class Attendance(BaseModel):
    class Source(models.TextChoices):
        MANUAL = "MANUAL", "Registro manual (check-in/out)"
        BIOMETRIC = "BIOMETRIC", "Importado del biométrico"
        MANUAL_CORRECTION = "MANUAL_CORRECTION", "Corregido manualmente por RRHH"

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField()
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    # Campos de asistencia biométrica (aditivos — todas las filas creadas por
    # el flujo manual existente (RegisterCheckIn/RegisterCheckOut) siguen
    # funcionando igual, con source=MANUAL por defecto).
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    break_start = models.DateTimeField(null=True, blank=True)
    break_end = models.DateTimeField(null=True, blank=True)
    raw_punches = models.ManyToManyField("RawBiometricPunch", blank=True, related_name="attendances")
    is_manually_corrected = models.BooleanField(default=False)
    corrected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="corrected_attendances"
    )
    corrected_at = models.DateTimeField(null=True, blank=True)
    correction_reason = models.TextField(blank=True)
    has_incomplete_marks = models.BooleanField(default=False)

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
        LOAN = "LOAN", "Préstamo"
        SCHEDULE_CHANGE = "SCHEDULE_CHANGE", "Cambio de horario empleado"
        LABOR_CERTIFICATE = "LABOR_CERTIFICATE", "Certificado laboral"
        OTHER = "OTHER", "Otro"

    class LoanFrequency(models.TextChoices):
        BIWEEKLY = "BIWEEKLY", "Quincenal"
        MONTHLY = "MONTHLY", "Mensual"

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

    # ── Datos exclusivos de solicitudes de tipo PRÉSTAMO ────────────────────────
    loan_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    loan_requester_name = models.CharField(max_length=180, blank=True)
    loan_requester_document = models.CharField(max_length=50, blank=True)
    loan_city = models.CharField(max_length=120, blank=True)
    loan_position = models.CharField(max_length=120, blank=True)
    loan_concept = models.CharField(max_length=255, blank=True)
    loan_frequency = models.CharField(max_length=20, choices=LoanFrequency.choices, blank=True)
    loan_installments_count = models.PositiveIntegerField(null=True, blank=True)
    loan_expense_number = models.CharField(max_length=30, blank=True)
    # Monto realmente aprobado por Administrador/Tesorería. Puede ser menor al
    # solicitado (loan_amount) si deciden autorizar solo una parte — se guarda
    # aparte para no perder el monto original pedido por el empleado. Si la
    # solicitud se aprueba sin tocar este campo, queda igual a loan_amount.
    loan_approved_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    loan_requester_signature = models.FileField(
        upload_to="hr/loans/signatures/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("png", "jpg", "jpeg"))],
    )

    # ── Datos exclusivos de solicitudes de tipo "Cambio de horario empleado" ────
    # El empleado puede proponer sus franjas semanales (deben sumar 42 horas).
    # Se conserva la plantilla como compatibilidad para solicitudes antiguas.
    requested_work_schedule_template = models.ForeignKey(
        "human_resources.WorkScheduleTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedule_change_requests",
    )
    requested_work_schedule_days = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Decisión del Administrador sobre si la solicitud es remunerada. No se
    # asigna automáticamente al aprobar (ni siquiera para horas extra): queda en
    # None ("Pendiente por definir") hasta que el Administrador la defina
    # explícitamente, en el momento de aprobar o después. Una vez guardada
    # (True o False) queda bloqueada de forma permanente — ni siquiera el propio
    # Administrador puede volver a cambiarla (ver VacationRequestViewSet.set_remuneration).
    is_remunerated = models.BooleanField(null=True, blank=True)
    remuneration_decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hr_remuneration_decisions",
    )
    remuneration_decided_at = models.DateTimeField(null=True, blank=True)

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
        update_fields = kwargs.get("update_fields")
        if not self.request_number:
            self.request_number = self.generate_request_number()
            if update_fields is not None:
                update_fields = set(update_fields)
                update_fields.add("request_number")
                kwargs["update_fields"] = tuple(update_fields)
        if self.request_type == self.RequestType.LOAN and not self.loan_expense_number:
            self.loan_expense_number = self.generate_loan_expense_number()
            if update_fields is not None:
                update_fields = set(update_fields)
                update_fields.add("loan_expense_number")
                kwargs["update_fields"] = tuple(update_fields)
        if self.start_date and self.end_date and not self.days_count:
            self.days_count = max((self.end_date - self.start_date).days + 1, 0)
            if update_fields is not None:
                update_fields = set(update_fields)
                update_fields.add("days_count")
                kwargs["update_fields"] = tuple(update_fields)
        if self.start_date and self.end_date and self.start_time and self.end_time:
            start_minutes = self.start_time.hour * 60 + self.start_time.minute
            end_minutes = self.end_time.hour * 60 + self.end_time.minute
            if end_minutes > start_minutes:
                day_count = max((self.end_date - self.start_date).days + 1, 1)
                total_minutes = (end_minutes - start_minutes) * day_count
                self.hours_count = (Decimal(total_minutes) / Decimal(60)).quantize(Decimal("0.01"))
                if update_fields is not None:
                    update_fields = set(update_fields)
                    update_fields.add("hours_count")
                    kwargs["update_fields"] = tuple(update_fields)
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

    @classmethod
    def generate_loan_expense_number(cls):
        prefix = f"EGR-{timezone.localdate():%Y%m}"
        next_number = cls.all_objects.filter(loan_expense_number__startswith=prefix).count() + 1
        while True:
            number = f"{prefix}-{next_number:04d}"
            if not cls.all_objects.filter(loan_expense_number=number).exists():
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


class OvertimeShift(BaseModel):
    """Turno individual de horas extra dentro de una misma solicitud (request_type=OVERTIME).

    Permite pedir varios días con horarios distintos (ej. lunes 2h, miércoles 3h,
    viernes 1h) en un solo trámite, en vez de una solicitud por cada día — la
    solicitud padre resume el rango de fechas y el total de horas de todos sus turnos."""

    request = models.ForeignKey(VacationRequest, on_delete=models.CASCADE, related_name="overtime_shifts")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    hours_count = models.DecimalField(max_digits=6, decimal_places=2, editable=False)
    notes = models.CharField(max_length=180, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("date", "start_time")

    def save(self, *args, **kwargs):
        start_minutes = self.start_time.hour * 60 + self.start_time.minute
        end_minutes = self.end_time.hour * 60 + self.end_time.minute
        total_minutes = max(end_minutes - start_minutes, 0)
        self.hours_count = (Decimal(total_minutes) / Decimal(60)).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.date} {self.start_time}-{self.end_time}"


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
    signature = models.FileField(
        upload_to="hr/requests/signatures/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("png", "jpg", "jpeg"))],
    )

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


class PayrollPeriod(BaseModel):
    """Contenedor quincenal del que cuelgan los Payroll individuales por
    empleado. Un período se genera una vez y todos los Payroll de esa
    quincena se calculan/recalculan a partir de él."""

    class Status(models.TextChoices):
        OPEN = "OPEN", "Abierto"
        CALCULATED = "CALCULATED", "Calculado"
        APPROVED = "APPROVED", "Aprobado"
        PAID = "PAID", "Pagado"
        CLOSED = "CLOSED", "Cerrado"

    period_start = models.DateField()
    period_end = models.DateField()
    label = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    calculated_at = models.DateTimeField(null=True, blank=True)
    calculated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="calculated_payroll_periods"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_payroll_periods"
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="paid_payroll_periods"
    )
    notes = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-period_start",)
        constraints = [
            models.UniqueConstraint(fields=("period_start", "period_end"), name="unique_payroll_period_range"),
        ]

    def __str__(self):
        return self.label or f"Período {self.period_start} - {self.period_end}"


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

    # Campos del motor de nómina quincenal (aditivos — Payroll ya existía
    # como CRUD manual; estos campos permiten que period_start/period_end
    # (que se mantienen, por compatibilidad con quien ya lea Payroll directo)
    # queden sincronizados con PayrollPeriod cuando se calcula automáticamente).
    period = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE, related_name="payrolls", null=True, blank=True)
    payslip_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    worked_days = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    ordinary_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    health_deduction = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    pension_deduction = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    gross_earnings = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_payrolls"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    signature = models.FileField(
        upload_to="hr/payroll/signatures/",
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("png", "jpg", "jpeg"))],
    )

    def __str__(self):
        return self.payslip_number or f"Nómina {self.employee} ({self.period_start} - {self.period_end})"


class PayrollItem(BaseModel):
    class Type(models.TextChoices):
        EARNING = "EARNING", "Devengado"
        DEDUCTION = "DEDUCTION", "Deducción"

    class Source(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        ATTENDANCE = "ATTENDANCE", "Cálculo de asistencia/horas"
        VACATION_REQUEST = "VACATION_REQUEST", "Solicitud (vacaciones/incapacidad/permiso)"
        LOAN_INSTALLMENT = "LOAN_INSTALLMENT", "Cuota de préstamo"
        SYSTEM = "SYSTEM", "Concepto legal calculado (salud, pensión, aux. transporte)"

    payroll = models.ForeignKey(Payroll, on_delete=models.CASCADE, related_name="items")
    item_type = models.CharField(max_length=20, choices=Type.choices)
    concept = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    # Trazabilidad de origen (aditivo) — concept_code es un string corto y
    # estable para agrupar/filtrar/reportar sin forzar un catálogo rígido.
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    source_vacation_request = models.ForeignKey(
        "VacationRequest", on_delete=models.SET_NULL, null=True, blank=True, related_name="payroll_items"
    )
    concept_code = models.CharField(max_length=40, blank=True)


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


class CompanyDocument(BaseModel):
    """Documento institucional publicado por RRHH (reglamento interno,
    política, comunicado, formato) visible en modo lectura para todos los
    empleados. Es el "documento lógico": el contenido real (el PDF y su
    vigencia) vive en las ``CompanyDocumentVersion`` relacionadas — este
    modelo agrupa el historial de versiones bajo un mismo nombre/categoría."""

    class Category(models.TextChoices):
        REGULATION = "REGULATION", "Reglamento"
        POLICY = "POLICY", "Políticas"
        ANNOUNCEMENT = "ANNOUNCEMENT", "Circulares"
        FORM = "FORM", "Formatos"
        MISSION_VISION = "MISSION_VISION", "Misión y Visión"

    category = models.CharField(max_length=20, choices=Category.choices, default=Category.REGULATION)
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("category", "name")

    @property
    def current_version(self):
        return self.versions.order_by("-version_number").first()

    def __str__(self):
        return self.name


class CompanyDocumentVersion(BaseModel):
    """Una versión publicada de un ``CompanyDocument``. ``version_number`` se
    autoincrementa por documento (1, 2, 3...) y se muestra como "N.0". La
    versión vigente de un documento es siempre la de mayor ``version_number``
    — publicar una nueva versión no borra ni oculta las anteriores, quedan
    disponibles como historial.

    ``visible_from``/``visible_until`` son opcionales: si se dejan vacíos la
    versión se ve siempre que sea la vigente. Si se definen, solo aparece en
    el listado de empleados (CompanyDocumentViewSet.get_queryset) mientras la
    fecha actual esté dentro del rango — RRHH sigue viéndola siempre."""

    document = models.ForeignKey(CompanyDocument, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    file = models.FileField(
        upload_to="human_resources/company_documents/",
        validators=[FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg", "doc", "docx"))],
    )
    visible_from = models.DateField(null=True, blank=True)
    visible_until = models.DateField(null=True, blank=True)
    published_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_company_document_versions",
    )

    class Meta(BaseModel.Meta):
        ordering = ("-version_number",)
        constraints = [
            models.UniqueConstraint(
                fields=("document", "version_number"),
                condition=models.Q(deleted_at__isnull=True),
                name="unique_active_version_per_document",
            ),
        ]

    @property
    def version_label(self):
        return f"{self.version_number}.0"

    def is_currently_visible(self):
        today = timezone.localdate()
        if self.visible_from and today < self.visible_from:
            return False
        if self.visible_until and today > self.visible_until:
            return False
        return True

    def __str__(self):
        return f"{self.document.name} v{self.version_label}"


class PublicHoliday(BaseModel):
    """Catálogo editable de festivos colombianos, por año. Se guarda con la
    fecha ya resuelta (traslado al lunes de la Ley Emiliani ya aplicado si
    corresponde) para no depender de recalcular la regla en cada consulta —
    la legislación laboral colombiana ya ha cambiado varias veces (ver
    overtime_pay.py), así que el catálogo real vive en esta tabla, editable,
    no hardcodeado en Python."""

    class Kind(models.TextChoices):
        FIXED = "FIXED", "Fecha fija"
        FIXED_MOVED_TO_MONDAY = "FIXED_MOVED_TO_MONDAY", "Fecha fija trasladada al lunes (Ley Emiliani)"
        EASTER_BASED = "EASTER_BASED", "Basado en Semana Santa"

    year = models.PositiveIntegerField()
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=30, choices=Kind.choices)
    civil_date = models.DateField()
    original_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("civil_date",)
        constraints = [
            models.UniqueConstraint(fields=("year", "civil_date"), name="unique_public_holiday_per_date"),
        ]

    def __str__(self):
        return f"{self.name} ({self.civil_date})"


class PayrollLegalParameter(BaseModel):
    """Parámetros legales que cambian cada año (SMMLV, auxilio de transporte,
    porcentajes de salud/pensión a cargo del empleado) — mismo espíritu que
    PublicHoliday: editable por año, no hardcodeado en Python."""

    year = models.PositiveIntegerField(unique=True)
    minimum_wage = models.DecimalField(max_digits=14, decimal_places=2)
    transport_allowance_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    transport_allowance_salary_cap_factor = models.DecimalField(max_digits=5, decimal_places=2, default=2)
    health_employee_pct = models.DecimalField(max_digits=5, decimal_places=2, default=4)
    pension_employee_pct = models.DecimalField(max_digits=5, decimal_places=2, default=4)
    monthly_hours_divisor_default = models.DecimalField(max_digits=6, decimal_places=2, default=230)

    # Porcentajes de recargo de horas, editables por año. Se dejan nullable a
    # propósito: si un año no tiene un valor explícito aquí, el motor usa el
    # default legal vigente calculado en overtime_pay.py (que ya modela el
    # escalonamiento 2025/2026/2027 de la reforma laboral, ej. recargo
    # dominical 90% desde jul-2026 y 100% desde jul-2027). Solo si RRHH edita
    # el valor de un año específico, ese valor fijo reemplaza al default
    # calculado para ese año — así una ley nueva no rompe años ya definidos.
    night_ordinary_surcharge_pct = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    day_extra_surcharge_pct = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    night_extra_surcharge_pct = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    sunday_holiday_surcharge_pct = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-year",)

    def __str__(self):
        return f"Parámetros legales {self.year}"


class WorkScheduleTemplate(BaseModel):
    """Plantilla de horario reutilizable (ej. "Turno mañana 7:00-16:30"),
    con sus franjas por día. Se define una vez y se aplica a múltiples
    empleados a la vez (ver ApplyWorkScheduleTemplate), en vez de tener que
    recapturar las mismas franjas manualmente por cada empleado — cubre el
    caso normal de que varios empleados compartan patrón de horario."""

    name = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("name",)

    def __str__(self):
        return self.name


class WorkScheduleTemplateDay(BaseModel):
    """Una franja horaria dentro de una WorkScheduleTemplate, por día de la
    semana. Mismo modelo de slots que EmployeeWorkScheduleDay para admitir
    jornada partida."""

    template = models.ForeignKey(WorkScheduleTemplate, on_delete=models.CASCADE, related_name="days")
    weekday = models.PositiveSmallIntegerField()
    slot = models.PositiveSmallIntegerField(default=1)
    expected_start_time = models.TimeField()
    expected_end_time = models.TimeField()
    is_working_day = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ("weekday", "slot")
        constraints = [
            models.UniqueConstraint(fields=("template", "weekday", "slot"), name="unique_template_weekday_slot"),
        ]

    def __str__(self):
        return f"{self.template} - día {self.weekday} slot {self.slot}"


class EmployeeWorkSchedule(BaseModel):
    """Cabecera de un horario vigente para un empleado, con rango de
    vigencia. Cuando el horario de un empleado cambia, se cierra la vigencia
    anterior (end_date) y se crea una nueva cabecera — mismo patrón que
    EmployeeSalaryHistory/EmployeePositionHistory en apps.employees.

    No se reutiliza WorkDay (catálogo compartido de días de la semana, sin
    horas de entrada/salida y sin vigencia por empleado) porque los horarios
    son distintos por empleado y cambian en el tiempo."""

    source_template = models.ForeignKey(
        WorkScheduleTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name="applied_schedules",
    )

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="work_schedules")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-start_date",)

    def __str__(self):
        return f"Horario de {self.employee} desde {self.start_date}"

    def expected_minutes_for(self, weekday: int) -> int:
        """Suma de minutos esperados para un día de la semana (0=lunes..6=domingo),
        sumando todas las franjas (permite jornada partida con descanso)."""
        total = 0
        for day in self.days.all():
            if day.weekday != weekday or not day.is_working_day:
                continue
            start = day.expected_start_time
            end = day.expected_end_time
            minutes = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)
            if minutes <= 0:
                minutes += 24 * 60
            if minutes > 0:
                total += minutes
        return total


class EmployeeWorkScheduleDay(BaseModel):
    """Una franja horaria esperada dentro de un EmployeeWorkSchedule, por día
    de la semana. Se permite más de una fila por día (slot) para modelar
    jornada partida (ej. 8:00-12:00 y 13:00-17:00 con descanso de almuerzo)."""

    schedule = models.ForeignKey(EmployeeWorkSchedule, on_delete=models.CASCADE, related_name="days")
    weekday = models.PositiveSmallIntegerField()
    slot = models.PositiveSmallIntegerField(default=1)
    expected_start_time = models.TimeField()
    expected_end_time = models.TimeField()
    is_working_day = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ("weekday", "slot")
        constraints = [
            models.UniqueConstraint(fields=("schedule", "weekday", "slot"), name="unique_schedule_weekday_slot"),
        ]

    def __str__(self):
        return f"{self.schedule} - día {self.weekday} slot {self.slot}"


def get_schedule_for(employee, reference_date):
    """Devuelve el EmployeeWorkSchedule vigente para un empleado en una fecha
    dada, o None si no hay ninguno configurado. Si hay solapes accidentales
    (no deberían darse si SetEmployeeWorkSchedule cierra correctamente el
    horario anterior), toma el más reciente por start_date."""
    return (
        EmployeeWorkSchedule.objects.filter(
            employee=employee,
            is_active=True,
            start_date__lte=reference_date,
        )
        .filter(models.Q(end_date__isnull=True) | models.Q(end_date__gte=reference_date))
        .order_by("-start_date")
        .prefetch_related("days")
        .first()
    )


class BiometricDevice(BaseModel):
    """Reloj biométrico del que se importan marcaciones. Opcional pero
    recomendado: si en el futuro hay más de un dispositivo (varias sedes),
    permite distinguir el origen del archivo importado."""

    name = models.CharField(max_length=120)
    location = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ("name",)

    def __str__(self):
        return self.name


class AttendanceIntelligenceSettings(BaseModel):
    """Parámetros operativos (no legales) que afinan cómo se interpretan las
    marcaciones del reloj biométrico — editable por RRHH sin tocar código.
    Se espera una sola fila activa (configuración global); si hay más de una,
    se usa la más reciente (mismo patrón de "toma la más reciente" que
    get_schedule_for)."""

    duplicate_punch_window_minutes = models.PositiveIntegerField(
        default=5,
        help_text="Marcaciones del mismo empleado separadas por menos de este tiempo se consideran "
                   "el mismo evento repetido por error (ej. marcó, creyó que falló, volvió a marcar) "
                   "y se colapsan en una sola en vez de contarse como entrada+salida real.",
    )
    schedule_proximity_minutes = models.PositiveIntegerField(
        default=120,
        help_text="Al inferir qué marcación es entrada y cuál es salida en un día con marcaciones "
                   "atípicas (1, 3, 5+), se prioriza la que caiga dentro de esta cercanía al horario "
                   "esperado del empleado, en vez de asumir ciegamente 'antes/después de mediodía'.",
    )
    is_active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)
        verbose_name = "Configuración de inteligencia de asistencia"
        verbose_name_plural = "Configuraciones de inteligencia de asistencia"

    def __str__(self):
        return f"Config. asistencia (dedup {self.duplicate_punch_window_minutes}min)"


def get_attendance_intelligence_settings():
    """Devuelve la configuración activa más reciente, o defaults razonables
    si RRHH todavía no ha configurado nada — el sistema funciona de
    inmediato sin necesitar que alguien lo configure primero."""
    settings_row = AttendanceIntelligenceSettings.objects.filter(is_active=True).order_by("-created_at").first()
    if settings_row:
        return settings_row
    return AttendanceIntelligenceSettings(duplicate_punch_window_minutes=5, schedule_proximity_minutes=120)


class EmployeeBiometricId(BaseModel):
    """Mapeo entre el código numérico interno del reloj biométrico (ej. '610',
    '15', '51' — NO es el employee_code del sistema) y el empleado real. Un
    empleado puede tener más de un código a lo largo del tiempo (ej. si se
    reasigna el número en el reloj), pero un código activo de un dispositivo
    debe apuntar a un único empleado para evitar ambigüedad al importar."""

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="biometric_ids")
    device = models.ForeignKey(BiometricDevice, on_delete=models.CASCADE, related_name="employee_mappings", null=True, blank=True)
    biometric_code = models.CharField(max_length=30)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateField(default=timezone.localdate)
    valid_to = models.DateField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("employee", "-valid_from")
        constraints = [
            models.UniqueConstraint(
                fields=("device", "biometric_code"),
                condition=models.Q(is_active=True, deleted_at__isnull=True),
                name="unique_active_biometric_code_per_device",
            ),
        ]

    def __str__(self):
        return f"{self.biometric_code} -> {self.employee}"


class BiometricImportBatch(BaseModel):
    """Un 'lote de carga': un archivo del reloj biométrico subido en un
    momento dado. Permite auditar quién subió qué y cuándo, y revisar el
    resultado de una carga completa antes de consolidarla en asistencia."""

    class Status(models.TextChoices):
        PROCESSING = "PROCESSING", "Procesando"
        COMPLETED = "COMPLETED", "Completado"
        FAILED = "FAILED", "Falló"

    file = models.FileField(upload_to="hr/biometric/imports/")
    device = models.ForeignKey(BiometricDevice, on_delete=models.SET_NULL, null=True, blank=True, related_name="import_batches")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROCESSING)
    total_rows = models.PositiveIntegerField(default=0)
    matched_rows = models.PositiveIntegerField(default=0)
    unmatched_rows = models.PositiveIntegerField(default=0)
    duplicate_rows = models.PositiveIntegerField(default=0)
    error_log = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)

    def __str__(self):
        return f"Importación biométrica {self.created_at:%Y-%m-%d %H:%M}"


class RawBiometricPunch(BaseModel):
    """Guarda exactamente lo que trae cada fila del archivo plano del reloj
    biométrico, sin interpretar. Las columnas 3-6 son de significado
    desconocido: se guardan tal cual llegan (como texto) para no perder
    información aunque hoy no se sepa qué representan."""

    device = models.ForeignKey(BiometricDevice, on_delete=models.SET_NULL, null=True, blank=True, related_name="raw_punches")
    biometric_code = models.CharField(max_length=30)
    punched_at = models.DateTimeField()
    raw_col3 = models.CharField(max_length=50, blank=True)
    raw_col4 = models.CharField(max_length=50, blank=True)
    raw_col5 = models.CharField(max_length=50, blank=True)
    raw_col6 = models.CharField(max_length=50, blank=True)
    raw_line = models.TextField(blank=True)
    import_batch = models.ForeignKey(BiometricImportBatch, on_delete=models.CASCADE, related_name="punches")
    matched_employee = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="raw_biometric_punches"
    )
    is_duplicate = models.BooleanField(default=False)
    duplicate_of = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="duplicates")

    class Meta(BaseModel.Meta):
        ordering = ("matched_employee", "punched_at")
        indexes = [models.Index(fields=("matched_employee", "punched_at"))]

    def __str__(self):
        return f"{self.biometric_code} - {self.punched_at}"
