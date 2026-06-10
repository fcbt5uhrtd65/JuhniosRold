from django.db import transaction
from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from ..domain.entities import PayrollCalculation
from ..infrastructure.models import Attendance, Payroll, VacationRequest


class RegisterCheckIn:
    def execute(self, employee):
        today = timezone.localdate()
        attendance, created = Attendance.objects.get_or_create(employee=employee, date=today)
        if not created and attendance.check_in:
            raise BusinessRuleViolation("El empleado ya registró su entrada hoy.")
        attendance.check_in = timezone.now()
        attendance.save()
        return attendance


class RegisterCheckOut:
    def execute(self, employee):
        attendance = Attendance.objects.filter(employee=employee, date=timezone.localdate()).first()
        if not attendance or not attendance.check_in:
            raise BusinessRuleViolation("No existe un check-in para hoy.")
        attendance.check_out = timezone.now()
        attendance.save(update_fields=("check_out", "updated_at"))
        return attendance


class ResolveVacationRequest:
    def execute(self, vacation, status, reviewer):
        if vacation.status != VacationRequest.Status.PENDING:
            raise BusinessRuleViolation("La solicitud ya fue resuelta.")
        vacation.status = status
        vacation.reviewed_by = reviewer
        vacation.reviewed_at = timezone.now()
        vacation.save(update_fields=("status", "reviewed_by", "reviewed_at", "updated_at"))
        return vacation


class GeneratePayroll:
    @transaction.atomic
    def execute(self, *, employee, period_start, period_end, base_salary, bonuses=0, deductions=0):
        calculation = PayrollCalculation(base_salary, bonuses, deductions)
        return Payroll.objects.create(
            employee=employee,
            period_start=period_start,
            period_end=period_end,
            base_salary=calculation.base_salary,
            bonuses=calculation.bonuses,
            deductions=calculation.deductions,
            net_salary=calculation.net_salary,
        )
