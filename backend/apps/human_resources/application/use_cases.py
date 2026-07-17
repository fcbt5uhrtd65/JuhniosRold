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


class ResolveVacationRequestByRole:
    """Flujo de dos responsables: Administrador y Recursos Humanos.

    - Un rechazo de cualquiera de los dos resuelve la solicitud como rechazada.
    - El Administrador tiene poder de aprobación unilateral (override).
    - RRHH aprobando primero deja la solicitud pendiente por el Administrador.
    - Solo queda "Aprobada" cuando el Administrador aprueba (con o sin RRHH previo).
    """

    TERMINAL_STATUSES = {
        VacationRequest.Status.APPROVED,
        VacationRequest.Status.REJECTED,
        VacationRequest.Status.CANCELLED,
        VacationRequest.Status.FINALIZED,
    }

    def execute(self, vacation, decision, reviewer, role, comment="", signature_override=None):
        if role not in ("ADMIN", "HR"):
            raise BusinessRuleViolation("Rol no autorizado para resolver solicitudes.")

        already_decided_by_role = (
            vacation.admin_decision if role == "ADMIN" else vacation.hr_decision
        )
        if already_decided_by_role:
            raise BusinessRuleViolation("Ya registraste tu decisión sobre esta solicitud.")

        # Caso especial permitido: Admin ya aprobó por override unilateral (status=APPROVED)
        # pero RRHH todavía no había dejado registrada su propia decisión. Se le permite
        # completar la trazabilidad sin reabrir ni cambiar el resultado final ya aprobado.
        is_late_hr_trace_on_admin_approval = (
            role == "HR"
            and vacation.status == VacationRequest.Status.APPROVED
            and vacation.admin_decision == VacationRequest.Status.APPROVED
            and not vacation.hr_decision
        )
        if vacation.status in self.TERMINAL_STATUSES and not is_late_hr_trace_on_admin_approval:
            raise BusinessRuleViolation("La solicitud ya fue resuelta.")
        if decision == VacationRequest.Status.REJECTED and not comment.strip():
            raise BusinessRuleViolation("Debes indicar el motivo del rechazo.")

        old_status = vacation.status
        now = timezone.now()
        update_fields = ["status", "updated_at"]

        if role == "ADMIN":
            vacation.admin_decision = decision
            vacation.admin_decided_by = reviewer
            vacation.admin_decided_at = now
            vacation.admin_comment = comment
            update_fields += ["admin_decision", "admin_decided_by", "admin_decided_at", "admin_comment"]
        else:
            vacation.hr_decision = decision
            vacation.hr_decided_by = reviewer
            vacation.hr_decided_at = now
            vacation.hr_comment = comment
            update_fields += ["hr_decision", "hr_decided_by", "hr_decided_at", "hr_comment"]

        if is_late_hr_trace_on_admin_approval:
            # El resultado final ya quedó fijado por el override de Admin; RRHH solo
            # completa su traza, sin mover el status ni sobreescribir reviewed_by/at.
            update_fields = [f for f in update_fields if f not in ("status", "reviewed_by", "reviewed_at")]
            vacation.save(update_fields=update_fields)
            VacationRequestApprovalStep.objects.update_or_create(
                request=vacation,
                step=VacationRequestApprovalStep.Step.HR,
                defaults={
                    "sequence": 3,
                    "status": decision,
                    "user": reviewer,
                    "acted_at": now,
                    "comment": comment,
                    **({"signature": signature_override} if signature_override else {}),
                },
            )
            VacationRequestHistory.objects.create(
                request=vacation,
                action=VacationRequestHistory.Action.COMMENTED,
                user=reviewer,
                old_status=vacation.status,
                new_status=vacation.status,
                comment=f"[HR] Traza registrada tras aprobación previa del Administrador: {comment}".strip(),
            )
            return vacation

        other_decision = vacation.hr_decision if role == "ADMIN" else vacation.admin_decision
        disagreement = bool(other_decision) and other_decision != decision

        if decision == VacationRequest.Status.REJECTED:
            vacation.status = VacationRequest.Status.REJECTED
        elif role == "ADMIN":
            vacation.status = VacationRequest.Status.APPROVED
        else:  # role == "HR", decision == APPROVED
            if vacation.admin_decision == VacationRequest.Status.APPROVED:
                vacation.status = VacationRequest.Status.APPROVED
            else:
                vacation.status = VacationRequest.Status.PENDING_ADMIN

        vacation.reviewed_by = reviewer
        vacation.reviewed_at = now
        update_fields += ["reviewed_by", "reviewed_at"]
        vacation.save(update_fields=update_fields)

        step_code = (
            VacationRequestApprovalStep.Step.FINAL
            if role == "ADMIN"
            else VacationRequestApprovalStep.Step.HR
        )
        VacationRequestApprovalStep.objects.update_or_create(
            request=vacation,
            step=step_code,
            defaults={
                "sequence": 4 if step_code == VacationRequestApprovalStep.Step.FINAL else 3,
                "status": decision,
                "user": reviewer,
                "acted_at": now,
                "comment": comment,
                **({"signature": signature_override} if signature_override else {}),
            },
        )
        history_comment = f"[{role}] {comment}".strip()
        if disagreement:
            other_role = "RRHH" if role == "ADMIN" else "Administrador"
            history_comment = (
                f"DESACUERDO: {other_role} había registrado '{other_decision}', "
                f"{('RRHH' if role == 'HR' else 'Administrador')} registró '{decision}'. {history_comment}"
            )
        VacationRequestHistory.objects.create(
            request=vacation,
            action=VacationRequestHistory.Action.APPROVED
            if decision == VacationRequest.Status.APPROVED
            else VacationRequestHistory.Action.REJECTED,
            user=reviewer,
            old_status=old_status,
            new_status=vacation.status,
            comment=history_comment,
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
