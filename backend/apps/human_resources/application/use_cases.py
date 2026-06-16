from django.db import transaction
from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from ..domain.entities import PayrollCalculation
from ..infrastructure.models import Attendance, Payroll, VacationRequest, VacationRequestApprovalStep, VacationRequestHistory


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
    def execute(self, vacation, status, reviewer, comment=""):
        if vacation.status not in {VacationRequest.Status.PENDING, VacationRequest.Status.IN_REVIEW}:
            raise BusinessRuleViolation("La solicitud ya fue resuelta.")
        old_status = vacation.status
        vacation.status = status
        vacation.reviewed_by = reviewer
        vacation.reviewed_at = timezone.now()
        vacation.save(update_fields=("status", "reviewed_by", "reviewed_at", "updated_at"))
        step_code = (
            VacationRequestApprovalStep.Step.FINAL
            if status == VacationRequest.Status.APPROVED
            else VacationRequestApprovalStep.Step.HR
        )
        VacationRequestApprovalStep.objects.update_or_create(
            request=vacation,
            step=step_code,
            defaults={
                "sequence": 4 if step_code == VacationRequestApprovalStep.Step.FINAL else 3,
                "status": status,
                "user": reviewer,
                "acted_at": timezone.now(),
                "comment": comment,
            },
        )
        VacationRequestHistory.objects.create(
            request=vacation,
            action=VacationRequestHistory.Action.APPROVED
            if status == VacationRequest.Status.APPROVED
            else VacationRequestHistory.Action.REJECTED,
            user=reviewer,
            old_status=old_status,
            new_status=status,
            comment=comment,
        )
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
