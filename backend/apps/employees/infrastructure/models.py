from django.conf import settings
from django.db import models

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


class Employee(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Activo"
        LEAVE = "LEAVE", "En licencia"
        SUSPENDED = "SUSPENDED", "Suspendido"
        TERMINATED = "TERMINATED", "Retirado"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_profile",
    )
    employee_code = models.CharField(max_length=30, unique=True)
    document_number = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="employees")
    position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="employees")
    manager = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="reports")
    hire_date = models.DateField()
    termination_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


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
    document = models.FileField(upload_to="employees/contracts/", blank=True)
