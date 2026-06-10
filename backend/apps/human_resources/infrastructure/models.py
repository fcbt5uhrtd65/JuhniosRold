from django.conf import settings
from django.db import models

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
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        APPROVED = "APPROVED", "Aprobada"
        REJECTED = "REJECTED", "Rechazada"

    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="vacations")
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)


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
    employee = models.ForeignKey("employees.Employee", on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=100)
    name = models.CharField(max_length=180)
    file = models.FileField(upload_to="employees/documents/")
    expires_at = models.DateField(null=True, blank=True)
