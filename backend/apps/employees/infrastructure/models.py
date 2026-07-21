from django.conf import settings
from django.core.validators import FileExtensionValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from shared.infrastructure.models import BaseModel


class Department(BaseModel):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Position(BaseModel):
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="positions")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("department", "name"), name="unique_position_per_department")
        ]


class Branch(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Activa"
        INACTIVE = "INACTIVE", "Inactiva"

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    department = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=80, default="Colombia", blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    responsible = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsible_branches",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class WorkDay(BaseModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=30)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ("sort_order", "name")

    def __str__(self):
        return self.name


class HRFieldConfiguration(BaseModel):
    class Section(models.TextChoices):
        PERSONAL = "PERSONAL", "Información personal"
        LABOR = "LABOR", "Información laboral"
        SOCIAL_SECURITY = "SOCIAL_SECURITY", "Seguridad social"
        BANKING = "BANKING", "Datos bancarios"
        PAYROLL = "PAYROLL", "Nómina"
        EMERGENCY = "EMERGENCY", "Contacto de emergencia"
        DOCUMENTS = "DOCUMENTS", "Documentos"
        ACCESS = "ACCESS", "Acceso al sistema"

    section = models.CharField(max_length=30, choices=Section.choices)
    field_name = models.CharField(max_length=120)
    label = models.CharField(max_length=180)
    is_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    help_text = models.TextField(blank=True)
    choices = models.JSONField(default=list, blank=True)

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=("section", "field_name"), name="unique_hr_field_configuration")
        ]
        ordering = ("section", "field_name")

    def __str__(self):
        return f"{self.get_section_display()} - {self.label}"


class Employee(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Activo"
        INACTIVE = "INACTIVE", "Inactivo"
        LEAVE = "LEAVE", "En licencia"
        SUSPENDED = "SUSPENDED", "Suspendido"
        TERMINATED = "TERMINATED", "Retirado"

    class ProfileStatus(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        REGISTERED = "REGISTERED", "Registrado"
        INCOMPLETE = "INCOMPLETE", "Incompleto"
        COMPLETE = "COMPLETE", "Completo"
        DOCUMENTED = "DOCUMENTED", "Documentado"
        RETIRED = "RETIRED", "Retirado"

    class DocumentType(models.TextChoices):
        CC = "CC", "Cédula de ciudadanía"
        CE = "CE", "Cédula de extranjería"
        PASSPORT = "PASSPORT", "Pasaporte"
        NIT = "NIT", "NIT"
        OTHER = "OTHER", "Otro"

    class Gender(models.TextChoices):
        FEMALE = "FEMALE", "Femenino"
        MALE = "MALE", "Masculino"
        NON_BINARY = "NON_BINARY", "No binario"
        OTHER = "OTHER", "Otro"
        NOT_SPECIFIED = "NOT_SPECIFIED", "Prefiere no decir"

    class MaritalStatus(models.TextChoices):
        SINGLE = "SINGLE", "Soltero/a"
        MARRIED = "MARRIED", "Casado/a"
        FREE_UNION = "FREE_UNION", "Unión libre"
        DIVORCED = "DIVORCED", "Divorciado/a"
        WIDOWED = "WIDOWED", "Viudo/a"
        OTHER = "OTHER", "Otro"

    class EmploymentType(models.TextChoices):
        EMPLOYEE = "EMPLOYEE", "Empleado"
        SENA_APPRENTICE = "SENA_APPRENTICE", "Aprendiz SENA"
        INTERN = "INTERN", "Practicante"
        CONTRACTOR = "CONTRACTOR", "Contratista"

    class ContractType(models.TextChoices):
        INDEFINITE = "INDEFINITE", "Indefinido"
        FIXED_TERM = "FIXED_TERM", "Término fijo"
        SERVICES = "SERVICES", "Prestación de servicios"
        APPRENTICESHIP = "APPRENTICESHIP", "Aprendizaje"
        INTERNSHIP = "INTERNSHIP", "Práctica"
        OTHER = "OTHER", "Otro"

    class WorkModality(models.TextChoices):
        ONSITE = "ONSITE", "Presencial"
        REMOTE = "REMOTE", "Remoto"
        HYBRID = "HYBRID", "Híbrido"

    class BankAccountType(models.TextChoices):
        SAVINGS = "SAVINGS", "Ahorros"
        CHECKING = "CHECKING", "Corriente"

    class SalaryType(models.TextChoices):
        FIXED = "FIXED", "Fijo"
        VARIABLE = "VARIABLE", "Variable"
        INTEGRAL = "INTEGRAL", "Integral"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_profile",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_employee_profiles",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_employee_profiles",
    )
    access_password = models.CharField(max_length=128, blank=True)
    access_password_updated_at = models.DateTimeField(null=True, blank=True)
    access_password_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_employee_access_passwords",
    )
    employee_code = models.CharField(max_length=30, unique=True, blank=True)
    profile_status = models.CharField(
        max_length=20,
        choices=ProfileStatus.choices,
        default=ProfileStatus.REGISTERED,
    )
    document_type = models.CharField(max_length=20, choices=DocumentType.choices, blank=True)
    document_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    document_issue_date = models.DateField(null=True, blank=True)
    document_issue_place = models.CharField(max_length=150, blank=True)
    first_name = models.CharField(max_length=120, blank=True)
    last_name = models.CharField(max_length=120, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    residence_department = models.CharField(max_length=120, blank=True)
    photo = models.FileField(
        upload_to="employees/photos/",
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("png", "jpg", "jpeg"))],
    )
    signature = models.FileField(
        upload_to="employees/signatures/",
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("png", "jpg", "jpeg"))],
    )
    nationality = models.CharField(max_length=80, blank=True, default="Colombiana")
    gender = models.CharField(max_length=20, choices=Gender.choices, blank=True)
    marital_status = models.CharField(max_length=20, choices=MaritalStatus.choices, blank=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="employees", null=True, blank=True)
    position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="employees", null=True, blank=True)
    manager = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="reports")
    employment_type = models.CharField(max_length=30, choices=EmploymentType.choices, default=EmploymentType.EMPLOYEE)
    contract_type = models.CharField(max_length=30, choices=ContractType.choices, default=ContractType.INDEFINITE)
    hire_date = models.DateField(null=True, blank=True)
    base_salary = models.DecimalField(max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    termination_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="employees", null=True, blank=True)
    cost_center = models.CharField(max_length=80, blank=True)
    work_modality = models.CharField(max_length=20, choices=WorkModality.choices, blank=True)
    termination_reason = models.TextField(blank=True)
    work_observations = models.TextField(blank=True)
    eps = models.CharField(max_length=150, blank=True)
    pension_fund = models.CharField(max_length=150, blank=True)
    severance_fund = models.CharField(max_length=150, blank=True)
    arl = models.CharField(max_length=150, blank=True)
    arl_risk_level = models.CharField(max_length=50, blank=True)
    compensation_fund = models.CharField(max_length=150, blank=True)
    bank_name = models.CharField(max_length=150, blank=True)
    bank_account_type = models.CharField(max_length=20, choices=BankAccountType.choices, blank=True)
    bank_account_number = models.CharField(max_length=80, blank=True)
    bank_account_holder = models.CharField(max_length=180, blank=True)
    bank_account_holder_document = models.CharField(max_length=80, blank=True)
    salary_type = models.CharField(max_length=20, choices=SalaryType.choices, default=SalaryType.FIXED)
    transport_allowance_applies = models.BooleanField(default=False)
    integral_salary = models.BooleanField(default=False)
    weekly_working_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    working_days = models.ManyToManyField(WorkDay, blank=True, related_name="employees")
    emergency_contact_name = models.CharField(max_length=180, blank=True)
    emergency_contact_relationship = models.CharField(max_length=80, blank=True)
    emergency_contact_mobile = models.CharField(max_length=30, blank=True)
    emergency_contact_alternate_phone = models.CharField(max_length=30, blank=True)
    emergency_contact_address = models.TextField(blank=True)

    REQUIRED_PROFILE_FIELDS = (
        "document_type",
        "document_number",
        "document_issue_date",
        "document_issue_place",
        "first_name",
        "last_name",
        "date_of_birth",
        "phone",
        "email",
        "address",
        "city",
        "residence_department",
        "nationality",
        "gender",
        "marital_status",
        "department_id",
        "position_id",
        "employment_type",
        "contract_type",
        "hire_date",
        "base_salary",
        "status",
        "branch_id",
    )

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if not self.employee_code:
            self.employee_code = self.generate_employee_code()
            if update_fields is not None:
                update_fields = set(update_fields)
                update_fields.add("employee_code")
                kwargs["update_fields"] = tuple(update_fields)
        if self.status == self.Status.TERMINATED:
            self.profile_status = self.ProfileStatus.RETIRED
        super().save(*args, **kwargs)

    @classmethod
    def generate_employee_code(cls):
        prefix = "EMP"
        next_number = cls.all_objects.filter(employee_code__startswith=f"{prefix}-").count() + 1
        while True:
            code = f"{prefix}-{next_number:05d}"
            if not cls.all_objects.filter(employee_code=code).exists():
                return code
            next_number += 1

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        today = timezone.localdate()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )

    @property
    def seniority_days(self):
        if not self.hire_date:
            return None
        end_date = self.termination_date or timezone.localdate()
        return max((end_date - self.hire_date).days, 0)

    @property
    def time_in_position_days(self):
        if not self.pk:
            return self.seniority_days
        latest_position = self.position_history.order_by("-start_date", "-created_at").first()
        start_date = latest_position.start_date if latest_position else self.hire_date
        if not start_date:
            return None
        return max((timezone.localdate() - start_date).days, 0)

    @property
    def remaining_contract_days(self):
        if not self.termination_date:
            return None
        return max((self.termination_date - timezone.localdate()).days, 0)

    @property
    def profile_completion_percentage(self):
        completed = 0
        for field_name in self.REQUIRED_PROFILE_FIELDS:
            value = getattr(self, field_name, None)
            if value not in (None, "", 0):
                completed += 1
        return round((completed / len(self.REQUIRED_PROFILE_FIELDS)) * 100)

    @property
    def pending_documents_count(self):
        if not self.pk:
            return 0
        required_document_types = {
            "ID_COPY",
            "RESUME",
            "SIGNED_CONTRACT",
            "BANK_CERTIFICATE",
            "EPS_CERTIFICATE",
            "PENSION_CERTIFICATE",
            "SEVERANCE_CERTIFICATE",
            "ARL_CERTIFICATE",
            "COMPENSATION_CERTIFICATE",
        }
        existing_documents = set(
            self.documents.exclude(status="NOT_APPLICABLE").values_list("document_type", flat=True)
        )
        not_applicable_documents = set(
            self.documents.filter(status="NOT_APPLICABLE").values_list("document_type", flat=True)
        )
        missing_documents = required_document_types - existing_documents - not_applicable_documents
        return self.documents.filter(status__in=("PENDING", "REJECTED")).count() + len(missing_documents)

    @property
    def expired_documents_count(self):
        if not self.pk:
            return 0
        today = timezone.localdate()
        return self.documents.filter(models.Q(status="EXPIRED") | models.Q(expires_at__lt=today)).count()


class EmployeeChangeLog(BaseModel):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="change_logs")
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    field_name = models.CharField(max_length=120)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.employee} - {self.field_name}"


class EmployeeSalaryHistory(BaseModel):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="salary_history")
    previous_salary = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    new_salary = models.DecimalField(max_digits=14, decimal_places=2)
    start_date = models.DateField(default=timezone.localdate)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-start_date", "-created_at")

    def __str__(self):
        return f"{self.employee} - {self.new_salary}"


class EmployeePositionHistory(BaseModel):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="position_history")
    previous_position = models.ForeignKey(
        Position,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="previous_employee_movements",
    )
    new_position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="employee_movements")
    start_date = models.DateField(default=timezone.localdate)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-start_date", "-created_at")

    def __str__(self):
        return f"{self.employee} - {self.new_position}"


class EmploymentContract(BaseModel):
    class Type(models.TextChoices):
        INDEFINITE = "INDEFINITE", "Indefinido"
        FIXED_TERM = "FIXED_TERM", "Término fijo"
        SERVICES = "SERVICES", "Prestación de servicios"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="contracts")
    contract_type = models.CharField(max_length=20, choices=Type.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    base_salary = models.DecimalField(max_digits=14, decimal_places=2)
    is_active = models.BooleanField(default=True)
    document = models.FileField(
        upload_to="employees/contracts/",
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg", "doc", "docx"))],
    )
