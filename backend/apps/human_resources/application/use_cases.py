from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from ..domain.entities import PayrollCalculation
from ..infrastructure.models import (
    Attendance,
    OvertimeShift,
    Payroll,
    VacationRequest,
    VacationRequestApprovalStep,
    VacationRequestHistory,
)


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


class CreateOvertimeRequestWithShifts:
    """Crea una solicitud de horas extra a partir de varios turnos (fecha + horario
    cada uno), en vez de exigir una solicitud separada por cada día distinto.

    La solicitud padre resume el rango de fechas (mínima a máxima) y el total de
    horas de todos sus turnos, para que todo lo que ya depende de esos campos
    (dashboard, PDF, flujo de aprobación) siga funcionando sin cambios."""

    @transaction.atomic
    def execute(self, employee, shifts_data, reason="", description="", observations="", support_document=None):
        if not shifts_data:
            raise BusinessRuleViolation("Debes indicar al menos un turno de horas extra.")

        parsed_shifts = []
        for shift in shifts_data:
            try:
                shift_date = shift["date"]
                start_time = shift["start_time"]
                end_time = shift["end_time"]
            except KeyError as exc:
                raise BusinessRuleViolation(f"Falta el campo {exc} en un turno.") from exc

            if isinstance(shift_date, str):
                shift_date = datetime.strptime(shift_date, "%Y-%m-%d").date()
            if isinstance(start_time, str):
                start_time = datetime.strptime(start_time, "%H:%M").time()
            if isinstance(end_time, str):
                end_time = datetime.strptime(end_time, "%H:%M").time()

            if end_time <= start_time:
                raise BusinessRuleViolation(f"La hora final debe ser posterior a la hora inicial ({shift_date}).")

            parsed_shifts.append({
                "date": shift_date,
                "start_time": start_time,
                "end_time": end_time,
                "notes": shift.get("notes", ""),
            })

        dates = [s["date"] for s in parsed_shifts]
        total_minutes = sum(
            (s["end_time"].hour * 60 + s["end_time"].minute) - (s["start_time"].hour * 60 + s["start_time"].minute)
            for s in parsed_shifts
        )
        total_hours = (Decimal(total_minutes) / Decimal(60)).quantize(Decimal("0.01"))

        vacation = VacationRequest.objects.create(
            employee=employee,
            request_type=VacationRequest.RequestType.OVERTIME,
            start_date=min(dates),
            end_date=max(dates),
            is_full_day=False,
            hours_count=total_hours,
            days_count=len(parsed_shifts),
            reason=reason,
            description=description,
            observations=observations,
            support_document=support_document,
        )

        OvertimeShift.objects.bulk_create([
            OvertimeShift(request=vacation, date=s["date"], start_time=s["start_time"], end_time=s["end_time"], notes=s["notes"])
            for s in parsed_shifts
        ])
        # bulk_create no dispara save() por instancia (donde se calcula hours_count),
        # así que se recalcula aquí para dejar cada turno con su total correcto.
        for shift in vacation.overtime_shifts.all():
            shift.save(update_fields=("hours_count", "updated_at"))

        return vacation


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
    """Flujo de responsables: Jefe inmediato (opinión), Administrador y Recursos Humanos.

    - El Jefe inmediato solo deja registrada su firma/decisión en el paso MANAGER
      (trazabilidad), a modo de recomendación — nunca mueve el status de la solicitud
      ni decide el resultado final. El Administrador siempre tiene la última palabra.
    - Un rechazo de Admin o RRHH resuelve la solicitud como rechazada.
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

    def _resolve_manager_step(self, vacation, decision, reviewer, comment, signature_override):
        """El jefe inmediato registra su firma/decisión en el paso MANAGER como
        recomendación de trazabilidad. No modifica vacation.status: el resultado
        final de la solicitud sigue dependiendo únicamente de RRHH/Administrador."""
        if vacation.status in self.TERMINAL_STATUSES:
            raise BusinessRuleViolation("La solicitud ya fue resuelta.")
        if decision == VacationRequest.Status.REJECTED and not comment.strip():
            raise BusinessRuleViolation("Debes indicar el motivo del rechazo.")

        step, _ = VacationRequestApprovalStep.objects.get_or_create(
            request=vacation,
            step=VacationRequestApprovalStep.Step.MANAGER,
            defaults={"sequence": 2},
        )
        if step.status in self.TERMINAL_STATUSES:
            raise BusinessRuleViolation("Ya registraste tu decisión sobre esta solicitud.")

        step.status = decision
        step.user = reviewer
        step.acted_at = timezone.now()
        step.comment = comment
        if signature_override:
            step.signature = signature_override
        step.save(update_fields=["status", "user", "acted_at", "comment", "signature", "updated_at"])

        VacationRequestHistory.objects.create(
            request=vacation,
            action=VacationRequestHistory.Action.APPROVED
            if decision == VacationRequest.Status.APPROVED
            else VacationRequestHistory.Action.REJECTED,
            user=reviewer,
            old_status=vacation.status,
            new_status=vacation.status,
            comment=f"[Jefe inmediato] {comment}".strip(),
        )
        return vacation

    def execute(self, vacation, decision, reviewer, role, comment="", signature_override=None):
        if role not in ("ADMIN", "HR", "MANAGER"):
            raise BusinessRuleViolation("Rol no autorizado para resolver solicitudes.")

        if role == "MANAGER":
            return self._resolve_manager_step(vacation, decision, reviewer, comment, signature_override)

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
