import json
import re
import unicodedata
from datetime import datetime, timedelta
from decimal import Decimal

from django.db import models, transaction
from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from ..domain.entities import PayrollCalculation
from ..infrastructure.biometric_import import parse_biometric_file
from ..infrastructure.holiday_calendar import generate_colombian_holidays
from ..infrastructure.models import (
    Attendance,
    BiometricImportBatch,
    EmployeeBiometricId,
    EmployeeWorkSchedule,
    EmployeeWorkScheduleDay,
    OvertimeShift,
    Payroll,
    PayrollItem,
    PayrollLegalParameter,
    PayrollPeriod,
    PublicHoliday,
    RawBiometricPunch,
    VacationRequest,
    VacationRequestApprovalStep,
    VacationRequestHistory,
    WorkScheduleTemplate,
    WorkScheduleTemplateDay,
    get_attendance_intelligence_settings,
    get_schedule_for,
)
from ..infrastructure.overtime_pay import SurchargeRates, classify_shift
from ..infrastructure.payroll_engine import (
    daily_rate_for,
    health_deduction_for,
    hourly_rate_for,
    pension_deduction_for,
    transport_allowance_for,
)

RECHARGE_LABEL_TO_CONCEPT_CODE = {
    "Ordinaria diurna": "ORDINARY_DAY",
    "Ordinaria nocturna": "ORDINARY_NIGHT",
    "Dominical diurna ordinaria": "ORDINARY_DAY_REST",
    "Dominical nocturna ordinaria": "ORDINARY_NIGHT_REST",
    "Extra diurna": "OVERTIME_DAY",
    "Extra nocturna": "OVERTIME_NIGHT",
    "Extra diurna dominical": "OVERTIME_DAY_REST",
    "Extra nocturna dominical": "OVERTIME_NIGHT_REST",
}
SCHEDULE_CHANGE_WEEKLY_MINUTES = 42 * 60
SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES = 60

PUNCH_ACTION_FIELDS = ("check_in", "check_out", "break_start", "break_end")
PUNCH_ACTION_NUMERIC_CODES = {
    "1": "check_in",
    "2": "check_out",
    "3": "break_start",
    "4": "break_end",
}
PUNCH_ACTION_ALIASES = {
    "check_in": (
        "entrada",
        "ingreso",
        "entrada laboral",
        "inicio jornada",
        "check in",
        "checkin",
        "clock in",
    ),
    "check_out": (
        "salida",
        "egreso",
        "salida laboral",
        "fin jornada",
        "check out",
        "checkout",
        "clock out",
    ),
    "break_start": (
        "inicio almuerzo",
        "salida almuerzo",
        "inicio descanso",
        "salida descanso",
        "inicio break",
        "break out",
        "meal out",
        "lunch out",
    ),
    "break_end": (
        "fin almuerzo",
        "entrada almuerzo",
        "regreso almuerzo",
        "fin descanso",
        "entrada descanso",
        "fin break",
        "break in",
        "meal in",
        "lunch in",
    ),
}
PUNCH_ACTION_PHRASES = tuple(
    sorted(
        (
            (alias, field)
            for field, aliases in PUNCH_ACTION_ALIASES.items()
            for alias in aliases
        ),
        key=lambda item: len(item[0]),
        reverse=True,
    )
)


def _normalize_punch_action_text(value) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    ascii_text = re.sub(r"[^a-z0-9]+", " ", ascii_text)
    return re.sub(r"\s+", " ", ascii_text).strip()


def biometric_punch_action(punch) -> str | None:
    """Devuelve el campo Attendance que representa la accion explicita del
    huellero, si la fila la trae de forma clara.

    Las exportaciones antiguas vistas traen columnas como "1 0 1 0" cuyo
    significado no estaba confirmado. Esas filas se consideran ambiguas y
    conservan la inferencia por orden, mientras que acciones textuales o un
    unico codigo numerico simple si se respetan.
    """
    raw_values = [
        getattr(punch, "raw_col3", ""),
        getattr(punch, "raw_col4", ""),
        getattr(punch, "raw_col5", ""),
        getattr(punch, "raw_col6", ""),
    ]

    matches = set()
    for raw_value in raw_values:
        normalized = _normalize_punch_action_text(raw_value)
        if not normalized:
            continue
        for phrase, field in PUNCH_ACTION_PHRASES:
            if re.search(rf"(^| ){re.escape(phrase)}($| )", normalized):
                matches.add(field)
                break
    if len(matches) == 1:
        return matches.pop()
    if len(matches) > 1:
        return None

    non_empty = [str(value).strip() for value in raw_values if str(value or "").strip()]
    if len(non_empty) == 1:
        return PUNCH_ACTION_NUMERIC_CODES.get(non_empty[0])
    return None


def is_schedule_change_request(vacation) -> bool:
    return (
        vacation.request_type == VacationRequest.RequestType.SCHEDULE_CHANGE
        or vacation.subtype == VacationRequest.RequestSubtype.SCHEDULE_CHANGE
    )


def _coerce_schedule_days_payload(days_data):
    if isinstance(days_data, str):
        try:
            days_data = json.loads(days_data)
        except ValueError as exc:
            raise BusinessRuleViolation("El horario solicitado debe ser una lista JSON válida.") from exc
    if not isinstance(days_data, list):
        raise BusinessRuleViolation("El horario solicitado debe ser una lista de días y horas.")
    return days_data


def _schedule_weekly_minutes(parsed_days) -> int:
    total = 0
    for day in parsed_days:
        if not day.get("is_working_day", True):
            continue
        start = day["expected_start_time"]
        end = day["expected_end_time"]
        gross_minutes = max((end.hour * 60 + end.minute) - (start.hour * 60 + start.minute), 0)
        if gross_minutes <= SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES:
            raise BusinessRuleViolation("Cada día laboral debe durar más de 1 hora para descontar el almuerzo.")
        total += gross_minutes - SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES
    return total


def _time_to_minutes(value) -> int:
    return value.hour * 60 + value.minute


def _minutes_to_time(value: int):
    value = max(0, min(value, 23 * 60 + 59))
    return datetime.strptime(f"{value // 60:02d}:{value % 60:02d}", "%H:%M").time()


def _lunch_window(start_minutes: int, end_minutes: int) -> tuple[int, int]:
    noon_start = 12 * 60
    noon_end = 13 * 60
    if start_minutes < noon_start and noon_end < end_minutes:
        return noon_start, noon_end

    lunch_start = start_minutes + ((end_minutes - start_minutes - SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES) // 2)
    lunch_start = max(start_minutes + 1, min(lunch_start, end_minutes - SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES - 1))
    return lunch_start, lunch_start + SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES


def schedule_change_days_with_lunch_break(parsed_days) -> list[dict]:
    expanded_days = []
    for day in parsed_days:
        if not day.get("is_working_day", True):
            continue

        start_minutes = _time_to_minutes(day["expected_start_time"])
        end_minutes = _time_to_minutes(day["expected_end_time"])
        if end_minutes - start_minutes <= SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES:
            raise BusinessRuleViolation("Cada día laboral debe durar más de 1 hora para descontar el almuerzo.")

        lunch_start, lunch_end = _lunch_window(start_minutes, end_minutes)
        expanded_days.append({
            **day,
            "slot": 1,
            "expected_start_time": day["expected_start_time"],
            "expected_end_time": _minutes_to_time(lunch_start),
        })
        expanded_days.append({
            **day,
            "slot": 2,
            "expected_start_time": _minutes_to_time(lunch_end),
            "expected_end_time": day["expected_end_time"],
        })
    return expanded_days


def validate_schedule_change_42_hours(days_data):
    payload = _coerce_schedule_days_payload(days_data)
    parsed_days = _parse_schedule_days(payload)
    total_minutes = _schedule_weekly_minutes(parsed_days)
    if total_minutes != SCHEDULE_CHANGE_WEEKLY_MINUTES:
        total_hours = total_minutes / 60
        raise BusinessRuleViolation(
            f"El horario solicitado debe sumar exactamente 42 horas laborales semanales descontando 1 hora de almuerzo por día; actualmente suma {total_hours:g}."
        )
    return payload, parsed_days


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

            try:
                if isinstance(shift_date, str):
                    shift_date = datetime.strptime(shift_date, "%Y-%m-%d").date()
                if isinstance(start_time, str):
                    start_time = datetime.strptime(start_time[:5], "%H:%M").time()
                if isinstance(end_time, str):
                    end_time = datetime.strptime(end_time[:5], "%H:%M").time()
            except (TypeError, ValueError) as exc:
                raise BusinessRuleViolation("Cada turno debe tener fecha YYYY-MM-DD y horas HH:MM validas.") from exc

            if end_time <= start_time:
                raise BusinessRuleViolation(f"La hora final debe ser posterior a la hora inicial ({shift_date}).")

            shift_minutes = (end_time.hour * 60 + end_time.minute) - (start_time.hour * 60 + start_time.minute)
            shift_hours = (Decimal(shift_minutes) / Decimal(60)).quantize(Decimal("0.01"))
            parsed_shifts.append({
                "date": shift_date,
                "start_time": start_time,
                "end_time": end_time,
                "hours_count": shift_hours,
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
            OvertimeShift(
                request=vacation,
                date=s["date"],
                start_time=s["start_time"],
                end_time=s["end_time"],
                hours_count=s["hours_count"],
                notes=s["notes"],
            )
            for s in parsed_shifts
        ])
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


class DefineRequestRemuneration:
    """Define si una solicitud es remunerada o no — decisión exclusiva del
    Administrador, independiente del acto de aprobar/rechazar: puede tomarse en
    el mismo momento de aprobar o en cualquier momento posterior, incluso con
    la solicitud ya aprobada. Una vez guardada (True o False) queda bloqueada
    de forma permanente: ni una segunda llamada del mismo Administrador puede
    cambiarla."""

    def execute(self, vacation, is_remunerated, reviewer):
        if vacation.is_remunerated is not None:
            raise BusinessRuleViolation(
                "La remuneración de esta solicitud ya fue definida y no se puede modificar."
            )
        vacation.is_remunerated = is_remunerated
        vacation.remuneration_decided_by = reviewer
        vacation.remuneration_decided_at = timezone.now()
        vacation.save(update_fields=("is_remunerated", "remuneration_decided_by", "remuneration_decided_at", "updated_at"))
        VacationRequestHistory.objects.create(
            request=vacation,
            action=VacationRequestHistory.Action.UPDATED,
            user=reviewer,
            old_status=vacation.status,
            new_status=vacation.status,
            comment=f"[Administrador] Definió la solicitud como {'remunerada' if is_remunerated else 'no remunerada'}.",
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

    def execute(self, vacation, decision, reviewer, role, comment="", signature_override=None, is_remunerated=None, hr_slot_label="RRHH", approved_amount=None):
        if role not in ("ADMIN", "HR", "MANAGER"):
            raise BusinessRuleViolation("Rol no autorizado para resolver solicitudes.")
        is_schedule_change = is_schedule_change_request(vacation)
        if is_schedule_change and role == "MANAGER":
            raise BusinessRuleViolation("El cambio de horario empleado solo puede aprobarlo Recursos Humanos o el Administrador.")
        if (
            is_schedule_change
            and decision == VacationRequest.Status.APPROVED
            and not vacation.requested_work_schedule_days
            and not vacation.requested_work_schedule_template_id
        ):
            raise BusinessRuleViolation("La solicitud de cambio de horario debe tener un horario seleccionado.")

        # Para trazabilidad: el slot "HR" normalmente es RRHH, pero en préstamos lo
        # ocupa Tesorería — hr_slot_label permite que el historial diga el nombre
        # correcto sin cambiar la lógica de campos (hr_decision, etc., que se
        # reutilizan igual para ambos casos).
        display_role = "Administrador" if role == "ADMIN" else hr_slot_label if role == "HR" else role

        if role == "MANAGER":
            return self._resolve_manager_step(vacation, decision, reviewer, comment, signature_override)

        # Si la solicitud es remunerada lo decide únicamente el Administrador, nunca
        # RRHH ni el jefe inmediato. Puede definirse en el mismo momento de aprobar
        # (aquí) o después con DefineRequestRemuneration — en ambos casos, una vez
        # guardada la decisión queda bloqueada de forma permanente.
        if role == "ADMIN" and is_remunerated is not None:
            DefineRequestRemuneration().execute(vacation, is_remunerated, reviewer)

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

        # Aprobación parcial de préstamos: Administrador o Tesorería pueden
        # autorizar un monto menor al solicitado directamente al aprobar. Si no
        # se indica, queda aprobado el monto completo (loan_amount).
        if (
            vacation.request_type == VacationRequest.RequestType.LOAN
            and decision == VacationRequest.Status.APPROVED
            and approved_amount is not None
        ):
            if approved_amount <= 0:
                raise BusinessRuleViolation("El monto aprobado debe ser mayor a cero.")
            if vacation.loan_amount is not None and approved_amount > vacation.loan_amount:
                raise BusinessRuleViolation("El monto aprobado no puede ser mayor al monto solicitado.")
            vacation.loan_approved_amount = approved_amount
            update_fields.append("loan_approved_amount")

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
                comment=f"[{display_role}] Traza registrada tras aprobación previa del Administrador: {comment}".strip(),
            )
            return vacation

        other_decision = vacation.hr_decision if role == "ADMIN" else vacation.admin_decision
        disagreement = bool(other_decision) and other_decision != decision

        is_loan = vacation.request_type == VacationRequest.RequestType.LOAN

        if decision == VacationRequest.Status.REJECTED:
            vacation.status = VacationRequest.Status.REJECTED
        elif role == "ADMIN":
            vacation.status = VacationRequest.Status.APPROVED
        elif is_loan or is_schedule_change:
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

        # Efecto secundario de "Cambio de horario": solo cuando la solicitud queda
        # efectivamente Aprobada (no en PENDING_ADMIN, que es un estado intermedio),
        # se aplica automáticamente la plantilla elegida por el empleado — mismo
        # espíritu que loan_approved_amount arriba, el cambio vive dentro del propio
        # flujo de aprobación en vez de requerir un paso manual aparte en Nómina.
        if (
            is_schedule_change
            and vacation.status == VacationRequest.Status.APPROVED
        ):
            if vacation.requested_work_schedule_days:
                _, parsed_days = validate_schedule_change_42_hours(vacation.requested_work_schedule_days)
                schedule_days = schedule_change_days_with_lunch_break(parsed_days)
                SetEmployeeWorkSchedule().execute(
                    employee=vacation.employee,
                    start_date=vacation.start_date,
                    days_data=schedule_days,
                    actor=reviewer,
                    notes=f"Aplicado automáticamente al aprobar solicitud {vacation.request_number or vacation.id}.",
                )
            elif vacation.requested_work_schedule_template_id:
                ApplyWorkScheduleTemplate().execute(
                    template=vacation.requested_work_schedule_template,
                    employee_ids=[vacation.employee_id],
                    start_date=vacation.start_date,
                    actor=reviewer,
                    notes=f"Aplicado automáticamente al aprobar solicitud {vacation.request_number or vacation.id}.",
                )

        step_code = (
            VacationRequestApprovalStep.Step.FINAL
            if role == "ADMIN"
            else VacationRequestApprovalStep.Step.HR
        )
        step_sequence = 3 if is_schedule_change and step_code == VacationRequestApprovalStep.Step.FINAL else (
            4 if step_code == VacationRequestApprovalStep.Step.FINAL else 3
        )
        VacationRequestApprovalStep.objects.update_or_create(
            request=vacation,
            step=step_code,
            defaults={
                "sequence": step_sequence,
                "status": decision,
                "user": reviewer,
                "acted_at": now,
                "comment": comment,
                **({"signature": signature_override} if signature_override else {}),
            },
        )
        history_comment = f"[{display_role}] {comment}".strip()
        if disagreement:
            other_role = hr_slot_label if role == "ADMIN" else "Administrador"
            history_comment = (
                f"DESACUERDO: {other_role} había registrado '{other_decision}', "
                f"{display_role} registró '{decision}'. {history_comment}"
            )
        if vacation.loan_approved_amount is not None and vacation.loan_amount is not None and vacation.loan_approved_amount < vacation.loan_amount:
            history_comment = (
                f"Aprobación parcial: se autorizó ${vacation.loan_approved_amount:,.2f} "
                f"de los ${vacation.loan_amount:,.2f} solicitados. {history_comment}"
            ).strip()
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


class GenerateYearHolidays:
    """Pre-puebla el catálogo editable de festivos de un año a partir de la
    regla legal colombiana (holiday_calendar.generate_colombian_holidays).
    No sobreescribe festivos que ya existan para ese año/fecha — respeta
    ediciones manuales previas de RRHH sobre el catálogo."""

    @transaction.atomic
    def execute(self, *, year, actor=None):
        if year < 1900 or year > 2200:
            raise BusinessRuleViolation("Año inválido.")

        generated = generate_colombian_holidays(year)
        existing_dates = set(
            PublicHoliday.objects.filter(year=year).values_list("civil_date", flat=True)
        )

        created = []
        for entry in generated:
            if entry["civil_date"] in existing_dates:
                continue
            holiday = PublicHoliday.objects.create(
                year=year,
                name=entry["name"],
                kind=entry["kind"],
                civil_date=entry["civil_date"],
                original_date=entry["original_date"],
            )
            created.append(holiday)

        return created


def _parse_schedule_days(days_data) -> list[dict]:
    """Valida y normaliza una lista de franjas horarias (weekday, horas,
    slot opcional) — compartido entre horarios individuales y plantillas
    para que ambos apliquen exactamente las mismas reglas."""
    if not days_data:
        raise BusinessRuleViolation("Debes indicar al menos un día de horario.")

    parsed_days = []
    for entry in days_data:
        weekday = entry.get("weekday")
        start_time = entry.get("expected_start_time")
        end_time = entry.get("expected_end_time")
        try:
            weekday = int(weekday)
            slot = int(entry.get("slot", 1))
        except (TypeError, ValueError) as exc:
            raise BusinessRuleViolation("Día de la semana o franja inválida.") from exc
        if not (0 <= weekday <= 6):
            raise BusinessRuleViolation("Día de la semana inválido (debe ser 0=lunes..6=domingo).")
        if not start_time or not end_time:
            raise BusinessRuleViolation("Cada franja requiere hora de inicio y hora de fin.")
        try:
            if isinstance(start_time, str):
                start_time = datetime.strptime(start_time[:5], "%H:%M").time()
            if isinstance(end_time, str):
                end_time = datetime.strptime(end_time[:5], "%H:%M").time()
        except (TypeError, ValueError) as exc:
            raise BusinessRuleViolation("Cada franja debe tener horas HH:MM válidas.") from exc
        if end_time <= start_time:
            raise BusinessRuleViolation("La hora de fin debe ser posterior a la hora de inicio en cada franja.")
        is_working_day = entry.get("is_working_day", True)
        if isinstance(is_working_day, str):
            is_working_day = is_working_day.strip().lower() not in ("false", "0", "no")
        parsed_days.append({
            "weekday": weekday,
            "slot": slot,
            "expected_start_time": start_time,
            "expected_end_time": end_time,
            "is_working_day": bool(is_working_day),
        })
    return parsed_days


class SetEmployeeWorkSchedule:
    """Reemplaza el horario vigente de un empleado a partir de una fecha:
    cierra (end_date = start_date - 1 día) cualquier EmployeeWorkSchedule
    activo previo que se solape, y crea la cabecera nueva con sus franjas por
    día en una sola transacción — mismo espíritu que EmployeeSalaryHistory
    (vigencia por rango de fechas, nunca se borra el horario anterior)."""

    @transaction.atomic
    def execute(self, *, employee, start_date, days_data, actor=None, notes="", source_template=None):
        try:
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        except (TypeError, ValueError) as exc:
            raise BusinessRuleViolation("La fecha de inicio debe tener formato YYYY-MM-DD.") from exc

        parsed_days = _parse_schedule_days(days_data)

        overlapping = EmployeeWorkSchedule.objects.filter(
            employee=employee, is_active=True
        ).filter(models.Q(end_date__isnull=True) | models.Q(end_date__gte=start_date))
        for previous in overlapping:
            previous_end = start_date - timedelta(days=1)
            if previous.start_date > previous_end:
                # El horario previo empieza en o después de la nueva vigencia:
                # no puede "cerrarse antes de empezar" — se desactiva en vez
                # de fijarle una fecha de cierre inconsistente.
                previous.is_active = False
                previous.save(update_fields=("is_active", "updated_at"))
            else:
                previous.end_date = previous_end
                previous.save(update_fields=("end_date", "updated_at"))

        schedule = EmployeeWorkSchedule.objects.create(
            employee=employee,
            start_date=start_date,
            created_by=actor if getattr(actor, "is_authenticated", False) else None,
            notes=notes,
            source_template=source_template,
        )
        EmployeeWorkScheduleDay.objects.bulk_create([
            EmployeeWorkScheduleDay(schedule=schedule, **entry) for entry in parsed_days
        ])
        return schedule


class CreateWorkScheduleTemplate:
    """Crea una plantilla de horario reutilizable con sus franjas por día.
    No toca ningún horario de empleado — es solo el catálogo."""

    @transaction.atomic
    def execute(self, *, name, days_data, actor=None, description=""):
        if not name or not name.strip():
            raise BusinessRuleViolation("La plantilla necesita un nombre.")
        parsed_days = _parse_schedule_days(days_data)

        template = WorkScheduleTemplate.objects.create(
            name=name.strip(),
            description=description,
            created_by=actor if getattr(actor, "is_authenticated", False) else None,
        )
        WorkScheduleTemplateDay.objects.bulk_create([
            WorkScheduleTemplateDay(template=template, **entry) for entry in parsed_days
        ])
        return template


class UpdateWorkScheduleTemplate:
    """Reemplaza nombre/descripción y franjas de una plantilla existente.
    No afecta horarios ya aplicados a empleados (EmployeeWorkSchedule copia
    las franjas al momento de aplicar, no las referencia en vivo)."""

    @transaction.atomic
    def execute(self, *, template, days_data=None, name=None, description=None):
        if name is not None:
            if not name.strip():
                raise BusinessRuleViolation("La plantilla necesita un nombre.")
            template.name = name.strip()
        if description is not None:
            template.description = description
        template.save(update_fields=("name", "description", "updated_at"))

        if days_data is not None:
            parsed_days = _parse_schedule_days(days_data)
            template.days.all().delete()
            WorkScheduleTemplateDay.objects.bulk_create([
                WorkScheduleTemplateDay(template=template, **entry) for entry in parsed_days
            ])
        return template


class ApplyWorkScheduleTemplate:
    """Aplica una plantilla de horario a varios empleados a la vez, a partir
    de una fecha común — reutiliza SetEmployeeWorkSchedule por cada empleado
    (misma regla de cierre de vigencia anterior). Acumula errores por
    empleado sin abortar la aplicación completa, mismo patrón que
    CalculatePayrollPeriod."""

    @transaction.atomic
    def execute(self, *, template, employee_ids, start_date, actor=None, notes=""):
        from apps.employees.infrastructure.models import Employee

        if not employee_ids:
            raise BusinessRuleViolation("Selecciona al menos un empleado.")

        days_data = [
            {
                "weekday": day.weekday,
                "slot": day.slot,
                "expected_start_time": day.expected_start_time,
                "expected_end_time": day.expected_end_time,
                "is_working_day": day.is_working_day,
            }
            for day in template.days.all()
        ]
        if not days_data:
            raise BusinessRuleViolation("La plantilla no tiene franjas configuradas.")

        applied = []
        errors = []
        for employee in Employee.objects.filter(id__in=employee_ids):
            try:
                with transaction.atomic():
                    schedule = SetEmployeeWorkSchedule().execute(
                        employee=employee,
                        start_date=start_date,
                        days_data=days_data,
                        actor=actor,
                        notes=notes,
                        source_template=template,
                    )
                applied.append(schedule)
            except BusinessRuleViolation as exc:
                errors.append({"employee_id": str(employee.id), "employee": str(employee), "error": str(exc)})

        return {"applied": applied, "errors": errors}


class ImportBiometricFile:
    """Parsea un archivo plano del reloj biométrico, resuelve el empleado de
    cada marcación vía EmployeeBiometricId, guarda cada fila tal cual llegó
    (RawBiometricPunch, sin interpretar las columnas opacas) y marca como
    duplicadas las marcaciones muy próximas en el tiempo del mismo empleado.

    NO consolida en Attendance en este paso — eso lo hace
    ConsolidateAttendanceFromPunches por separado, para que RRHH pueda
    revisar el resultado de la importación antes de que impacte la
    asistencia oficial."""

    @transaction.atomic
    def execute(self, *, file, actor=None, device=None, date_from=None, date_to=None, resolve_employees=False):
        batch = BiometricImportBatch.objects.create(
            file=file,
            device=device,
            uploaded_by=actor if getattr(actor, "is_authenticated", False) else None,
            status=BiometricImportBatch.Status.PROCESSING,
        )

        try:
            rows = parse_biometric_file(file)
        except Exception as exc:  # noqa: BLE001 - error irrecuperable de parseo, se registra y se propaga como fallo del batch
            batch.status = BiometricImportBatch.Status.FAILED
            batch.error_log = str(exc)
            batch.save(update_fields=("status", "error_log", "updated_at"))
            raise BusinessRuleViolation(f"No se pudo procesar el archivo: {exc}") from exc

        error_lines = [row for row in rows if "error" in row]
        valid_rows = [row for row in rows if "error" not in row]
        if date_from:
            valid_rows = [row for row in valid_rows if row["punched_at"].date() >= date_from]
        if date_to:
            valid_rows = [row for row in valid_rows if row["punched_at"].date() <= date_to]

        if not valid_rows:
            message = "No se encontraron marcaciones en el archivo TXT para el rango de fechas seleccionado."
            batch.status = BiometricImportBatch.Status.FAILED
            batch.error_log = message
            batch.processed_at = timezone.now()
            batch.save(update_fields=("status", "error_log", "processed_at", "updated_at"))
            raise BusinessRuleViolation(message)

        codes_in_file = {row["biometric_code"] for row in valid_rows}
        mapping_resolver = self._build_mapping_resolver(codes_in_file, device) if resolve_employees else None

        punches = []
        for row in valid_rows:
            employee_id = mapping_resolver(row["biometric_code"], row["punched_at"].date()) if mapping_resolver else None
            punches.append(RawBiometricPunch(
                device=device,
                biometric_code=row["biometric_code"],
                punched_at=row["punched_at"],
                raw_col3=row["raw_col3"],
                raw_col4=row["raw_col4"],
                raw_col5=row["raw_col5"],
                raw_col6=row["raw_col6"],
                raw_line=row["raw_line"],
                import_batch=batch,
                matched_employee_id=employee_id,
            ))
        created_punches = RawBiometricPunch.objects.bulk_create(punches, batch_size=500)

        duplicate_count = self._mark_duplicates(created_punches)

        matched_count = sum(1 for p in created_punches if p.matched_employee_id)
        unmatched_count = len(created_punches) - matched_count

        batch.total_rows = len(valid_rows)
        batch.matched_rows = matched_count
        batch.unmatched_rows = unmatched_count
        batch.duplicate_rows = duplicate_count
        batch.status = BiometricImportBatch.Status.COMPLETED
        batch.processed_at = timezone.now()
        if error_lines:
            batch.error_log = "\n".join(
                f"Línea {row['line_number']}: {row['error']}" for row in error_lines
            )
        batch.save(update_fields=(
            "total_rows", "matched_rows", "unmatched_rows", "duplicate_rows",
            "status", "processed_at", "error_log", "updated_at",
        ))
        return batch

    def _build_mapping_resolver(self, codes: set, device):
        """Resuelve código biométrico + fecha -> employee_id.

        El código del reloj es el identificador real; el dispositivo es
        metadato opcional. Si se filtrara estrictamente por `device`, subir
        un archivo sin elegir dispositivo (o con uno distinto al usado al
        crear los mapeos) dejaría todas las marcaciones sin empleado aunque
        el mapeo exista — por eso se cargan los mapeos del código sin
        filtrar por device, y solo se usa `device` para desempatar cuando el
        mismo código está mapeado a más de un empleado (p. ej. dos sedes con
        relojes distintos reutilizando numeración). Se respeta la vigencia
        (valid_from/valid_to) contra la fecha real de cada marcación, ya que
        un código puede reasignarse a otro empleado con el tiempo."""
        if not codes:
            return lambda code, punch_date: None

        candidates = (
            EmployeeBiometricId.objects
            .filter(is_active=True, biometric_code__in=codes)
            .order_by("biometric_code")
        )
        by_code: dict[str, list] = {}
        for mapping in candidates:
            by_code.setdefault(mapping.biometric_code, []).append(mapping)

        def resolve(code: str, punch_date):
            mappings = by_code.get(code)
            if not mappings:
                return None

            valid = [
                m for m in mappings
                if m.valid_from <= punch_date and (m.valid_to is None or punch_date <= m.valid_to)
            ]
            if not valid:
                return None

            if device is not None:
                same_device = [m for m in valid if m.device_id == device.id]
                if same_device:
                    valid = same_device

            employee_ids = {m.employee_id for m in valid}
            if len(employee_ids) != 1:
                return None  # ambiguo (varios empleados posibles) — no se adivina
            return employee_ids.pop()

        return resolve

    def _mark_duplicates(self, punches) -> int:
        """Agrupa por empleado resuelto o, si aun no hay relacion con empleado,
        por codigo biometrico, y marca como duplicadas las
        marcaciones consecutivas separadas por menos de la ventana
        configurada en AttendanceIntelligenceSettings (default 15 min),
        conservando la primera de cada grupo como canónica. No borra ninguna
        fila — cubre el caso de "marqué, creí que falló, volví a marcar"."""
        by_employee: dict[str, list] = {}
        for punch in punches:
            key = punch.matched_employee_id or f"code:{punch.biometric_code}"
            by_employee.setdefault(key, []).append(punch)

        settings_row = get_attendance_intelligence_settings()
        window = timedelta(minutes=settings_row.duplicate_punch_window_minutes)
        duplicate_count = 0
        to_update = []
        for employee_punches in by_employee.values():
            employee_punches.sort(key=lambda p: p.punched_at)
            canonical = employee_punches[0]
            for punch in employee_punches[1:]:
                if punch.punched_at - canonical.punched_at < window:
                    punch.is_duplicate = True
                    punch.duplicate_of = canonical
                    to_update.append(punch)
                    duplicate_count += 1
                else:
                    canonical = punch

        if to_update:
            RawBiometricPunch.objects.bulk_update(to_update, ("is_duplicate", "duplicate_of"))
        return duplicate_count


class ConsolidateAttendanceFromPunches:
    """Agrupa las marcaciones de un lote de importación por
    (empleado, fecha) e infiere entrada/salida/descansos, creando o
    actualizando la fila Attendance consolidada de ese día.

    Regla de inferencia (dado que las marcaciones olvidadas/incompletas son
    el caso esperado, no la excepción):
      - 2 marcaciones: la más temprana = check_in, la más tardía = check_out.
      - 4 marcaciones: 1a=check_in, 2a=break_start, 3a=break_end, 4a=check_out.
      - 1 marcación: se compara contra el horario esperado del empleado ese
        día (EmployeeWorkSchedule) para decidir si es entrada o salida —
        importante porque cada empleado puede tener un patrón distinto (ej.
        7:30-16:00 vs. 7:00-16:30); si no hay horario configurado, se cae al
        criterio simple antes/después de mediodía. Siempre queda
        has_incomplete_marks=True (inferencia débil, requiere revisión).
      - 3 o más de 4 (tras el colapso por proximidad): 1a=check_in,
        última=check_out, sin forzar descansos intermedios,
        has_incomplete_marks=True.

    Si el Attendance del día ya fue corregido manualmente
    (is_manually_corrected=True), NO se sobreescribe — la corrección humana
    siempre gana sobre una reimportación/reconsolidación."""

    @transaction.atomic
    def execute(self, *, import_batch, actor=None):
        punches = list(
            import_batch.punches.filter(matched_employee__isnull=False)
            .select_related("matched_employee")
            .order_by("matched_employee_id", "punched_at")
        )

        by_employee_day: dict[tuple, list] = {}
        for punch in punches:
            key = (punch.matched_employee_id, punch.punched_at.date())
            by_employee_day.setdefault(key, []).append(punch)

        created = 0
        updated = 0
        skipped_corrected = 0
        incomplete = 0
        employees_cache: dict[str, object] = {}

        for (employee_id, day), day_punches in by_employee_day.items():
            day_punches.sort(key=lambda p: p.punched_at)
            existing = Attendance.objects.filter(employee_id=employee_id, date=day).first()
            if existing and existing.is_manually_corrected:
                skipped_corrected += 1
                continue

            if employee_id not in employees_cache:
                employees_cache[employee_id] = day_punches[0].matched_employee
            employee = employees_cache[employee_id]
            schedule = get_schedule_for(employee, day)

            values = self._infer_attendance(day_punches, schedule, day)
            if values["has_incomplete_marks"]:
                incomplete += 1

            attendance, was_created = Attendance.objects.update_or_create(
                employee_id=employee_id,
                date=day,
                defaults={
                    "check_in": values["check_in"],
                    "check_out": values["check_out"],
                    "break_start": values["break_start"],
                    "break_end": values["break_end"],
                    "source": Attendance.Source.BIOMETRIC,
                    "has_incomplete_marks": values["has_incomplete_marks"],
                },
            )
            attendance.raw_punches.set(day_punches)
            if was_created:
                created += 1
            else:
                updated += 1

        return {
            "created": created,
            "updated": updated,
            "skipped_corrected": skipped_corrected,
            "incomplete": incomplete,
        }

    def _expected_times(self, schedule, day):
        """(hora_entrada_esperada, hora_salida_esperada) del día, o (None, None)
        si no hay horario configurado o el día no tiene franjas activas."""
        if not schedule:
            return None, None
        day_slots = [d for d in schedule.days.all() if d.weekday == day.weekday() and d.is_working_day]
        if not day_slots:
            return None, None
        day_slots.sort(key=lambda d: d.expected_start_time)
        return day_slots[0].expected_start_time, day_slots[-1].expected_end_time

    def _infer_attendance(self, day_punches, schedule=None, day=None) -> dict:
        action_values = self._infer_attendance_from_punch_actions(day_punches)
        if action_values is not None:
            return action_values

        count = len(day_punches)
        times = [p.punched_at for p in day_punches]

        if count == 2:
            return {
                "check_in": times[0], "check_out": times[1],
                "break_start": None, "break_end": None,
                "has_incomplete_marks": False,
            }
        if count == 4:
            return {
                "check_in": times[0], "break_start": times[1],
                "break_end": times[2], "check_out": times[3],
                "has_incomplete_marks": False,
            }
        if count == 1:
            only = times[0]
            expected_start, expected_end = self._expected_times(schedule, day) if day else (None, None)
            if expected_start and expected_end:
                start_dt = datetime.combine(day, expected_start)
                end_dt = datetime.combine(day, expected_end)
                is_closer_to_start = abs(only - start_dt) <= abs(only - end_dt)
            else:
                is_closer_to_start = only.hour < 12
            return {
                "check_in": only if is_closer_to_start else None,
                "check_out": only if not is_closer_to_start else None,
                "break_start": None, "break_end": None,
                "has_incomplete_marks": True,
            }
        # 3, o 5+ (tras colapsar duplicados cercanos al horario): 1a=check_in,
        # última=check_out, sin forzar descansos intermedios.
        return {
            "check_in": times[0], "check_out": times[-1],
            "break_start": None, "break_end": None,
            "has_incomplete_marks": True,
        }

    def _infer_attendance_from_punch_actions(self, day_punches) -> dict | None:
        action_punches = {field: [] for field in PUNCH_ACTION_FIELDS}
        unknown_punches = []
        for punch in day_punches:
            action = biometric_punch_action(punch)
            if action in action_punches:
                action_punches[action].append(punch)
            else:
                unknown_punches.append(punch)

        if not any(action_punches.values()):
            return None

        check_in = self._first_punch_time(action_punches["check_in"])
        check_out = self._last_punch_time(action_punches["check_out"])
        break_start = self._first_punch_time(action_punches["break_start"])
        break_end = self._last_punch_time(action_punches["break_end"])

        has_incomplete_marks = bool(unknown_punches) or not (check_in and check_out)
        if len(day_punches) not in (2, 4):
            has_incomplete_marks = True
        if any(getattr(punch, "is_duplicate", False) for punch in day_punches):
            has_incomplete_marks = True
        if check_in and check_out and check_out <= check_in:
            has_incomplete_marks = True
        if (break_start and not break_end) or (break_end and not break_start):
            has_incomplete_marks = True
        if break_start and break_end and break_end <= break_start:
            has_incomplete_marks = True

        return {
            "check_in": check_in,
            "check_out": check_out,
            "break_start": break_start,
            "break_end": break_end,
            "has_incomplete_marks": has_incomplete_marks,
        }

    def _first_punch_time(self, punches):
        if not punches:
            return None
        return min(punch.punched_at for punch in punches)

    def _last_punch_time(self, punches):
        if not punches:
            return None
        return max(punch.punched_at for punch in punches)


class CorrectAttendance:
    """Corrección manual de una fila de asistencia (marcación olvidada o
    incompleta — el caso esperado, no la excepción). Exige un motivo,
    registra quién y cuándo corrigió, y marca is_manually_corrected=True para
    que una futura reconsolidación biométrica no la sobreescriba.

    Deliberadamente NO cambia el campo 'source': si la fila venía del
    biométrico, sigue mostrando que su origen fue biométrico — la evidencia
    de "esto se tocó a mano" vive en is_manually_corrected, no en source."""

    def execute(self, *, attendance, check_in=None, check_out=None, break_start=None, break_end=None,
                reason, actor=None):
        if not reason or not reason.strip():
            raise BusinessRuleViolation("Debes indicar el motivo de la corrección.")
        if check_in and check_out and check_out <= check_in:
            raise BusinessRuleViolation("La salida debe ser posterior a la entrada.")

        attendance.check_in = check_in
        attendance.check_out = check_out
        attendance.break_start = break_start
        attendance.break_end = break_end
        attendance.has_incomplete_marks = not (check_in and check_out)
        attendance.is_manually_corrected = True
        attendance.corrected_by = actor if getattr(actor, "is_authenticated", False) else None
        attendance.corrected_at = timezone.now()
        attendance.correction_reason = reason
        attendance.save(update_fields=(
            "check_in", "check_out", "break_start", "break_end", "has_incomplete_marks",
            "is_manually_corrected", "corrected_by", "corrected_at", "correction_reason", "updated_at",
        ))
        return attendance


class CreatePayrollPeriod:
    """Crea un período quincenal de nómina. La periodicidad exacta (15 días)
    es una convención de negocio, no una restricción dura de fechas de
    calendario — no se valida la duración exacta, solo que no se solape con
    un período ya existente."""

    def execute(self, *, period_start, period_end, actor=None, label=""):
        if isinstance(period_start, str):
            period_start = datetime.strptime(period_start, "%Y-%m-%d").date()
        if isinstance(period_end, str):
            period_end = datetime.strptime(period_end, "%Y-%m-%d").date()
        if period_end <= period_start:
            raise BusinessRuleViolation("La fecha de fin debe ser posterior a la fecha de inicio.")

        overlapping = PayrollPeriod.objects.filter(
            period_start__lte=period_end, period_end__gte=period_start
        ).exists()
        if overlapping:
            raise BusinessRuleViolation("Ya existe un período de nómina que se solapa con ese rango de fechas.")

        return PayrollPeriod.objects.create(
            period_start=period_start,
            period_end=period_end,
            label=label or f"{period_start:%Y-%m-%d} a {period_end:%Y-%m-%d}",
        )


class CalculateEmployeePayrollForPeriod:
    """El corazón del motor de nómina: calcula la liquidación quincenal de
    UN empleado, día por día, combinando:
      - el horario esperado vigente de ese empleado (EmployeeWorkSchedule),
      - la asistencia consolidada de cada día (Attendance),
      - el catálogo de festivos del período (PublicHoliday),
      - las novedades aprobadas dentro del período (VacationRequest: vacaciones,
        incapacidades, permisos no remunerados, préstamos, horas extra).

    Regla de horas extra: el exceso trabajado segun la asistencia consolidada
    se liquida contra el horario esperado vigente del dia y se clasifica como
    extra diurna/nocturna/dominical segun la hora real. Las solicitudes de
    horas extra aprobadas siguen siendo validas; si una solicitud cubre una
    fecha, no se duplica la extra detectada por asistencia de ese mismo dia.

    Recalculo idempotente: borra los PayrollItem con source != MANUAL del
    cálculo anterior de ese empleado/período antes de regenerar, preservando
    cualquier ajuste manual que RRHH haya añadido a mano."""

    @transaction.atomic
    def execute(self, *, period, employee, actor=None):
        if period.status not in (PayrollPeriod.Status.OPEN, PayrollPeriod.Status.CALCULATED):
            raise BusinessRuleViolation("Solo se puede calcular un período que esté Abierto o ya Calculado.")

        legal_parameter = PayrollLegalParameter.objects.filter(year=period.period_start.year).first()
        period_days = Decimal((period.period_end - period.period_start).days + 1)
        period_base_salary = (daily_rate_for(employee, period.period_start) * period_days).quantize(Decimal("0.01"))
        hourly_rate = hourly_rate_for(employee, period.period_start, legal_parameter)

        holiday_dates = frozenset(
            PublicHoliday.objects.filter(
                is_active=True, civil_date__gte=period.period_start, civil_date__lte=period.period_end
            ).values_list("civil_date", flat=True)
        )
        rates = SurchargeRates(
            night_ordinary_pct=legal_parameter.night_ordinary_surcharge_pct if legal_parameter else None,
            day_extra_pct=legal_parameter.day_extra_surcharge_pct if legal_parameter else None,
            night_extra_pct=legal_parameter.night_extra_surcharge_pct if legal_parameter else None,
            sunday_holiday_pct=legal_parameter.sunday_holiday_surcharge_pct if legal_parameter else None,
        )

        payroll, _ = Payroll.objects.update_or_create(
            employee=employee,
            period=period,
            defaults={
                "period_start": period.period_start,
                "period_end": period.period_end,
                "base_salary": period_base_salary,
                "status": Payroll.Status.DRAFT,
            },
        )
        # Recálculo idempotente: se conservan los ajustes manuales que RRHH
        # haya agregado a mano, se descartan los que el motor generó antes.
        payroll.items.exclude(source=PayrollItem.Source.MANUAL).delete()

        recharge_minutes = self._accumulate_recharge_minutes(employee, period, holiday_dates, rates)
        worked_days, ordinary_minutes = self._count_worked_days(employee, period)

        new_items = []
        if period_base_salary > 0:
            new_items.append(PayrollItem(
                payroll=payroll,
                item_type=PayrollItem.Type.EARNING,
                concept=f"Salario ordinario ({period_days:.0f} dia(s))",
                amount=period_base_salary,
                source=PayrollItem.Source.SYSTEM,
                concept_code="BASE_SALARY",
            ))
        for (label, surcharge_pct), minutes in recharge_minutes.items():
            if minutes <= 0:
                continue
            hours = Decimal(minutes) / Decimal(60)
            amount = (hourly_rate * (Decimal(100) + surcharge_pct) / Decimal(100) * hours).quantize(Decimal("0.01"))
            if amount <= 0:
                continue
            new_items.append(PayrollItem(
                payroll=payroll,
                item_type=PayrollItem.Type.EARNING,
                concept=f"{label} ({100 + surcharge_pct:.0f}%)",
                amount=amount,
                source=PayrollItem.Source.ATTENDANCE,
                concept_code=RECHARGE_LABEL_TO_CONCEPT_CODE.get(label, "OTHER_HOURS"),
            ))

        _, approved_overtime_hours, approved_overtime_dates = self._approved_overtime_items(
            payroll, employee, period, hourly_rate, holiday_dates, new_items, rates
        )
        _, attendance_overtime_hours = self._attendance_overtime_items(
            payroll,
            employee,
            period,
            hourly_rate,
            holiday_dates,
            new_items,
            rates,
            skip_dates=approved_overtime_dates,
        )
        overtime_hours = (approved_overtime_hours + attendance_overtime_hours).quantize(Decimal("0.01"))
        new_items.extend(self._vacation_request_items(payroll, employee, period, actor))

        monthly_transport = transport_allowance_for(employee, legal_parameter) if legal_parameter else Decimal("0")
        transport = (monthly_transport / Decimal("30") * period_days).quantize(Decimal("0.01")) if monthly_transport > 0 else Decimal("0")
        if transport > 0:
            new_items.append(PayrollItem(
                payroll=payroll, item_type=PayrollItem.Type.EARNING, concept="Auxilio de transporte",
                amount=transport, source=PayrollItem.Source.SYSTEM, concept_code="TRANSPORT_ALLOWANCE",
            ))

        health = health_deduction_for(period_base_salary, legal_parameter) if legal_parameter else Decimal("0")
        if health > 0:
            new_items.append(PayrollItem(
                payroll=payroll, item_type=PayrollItem.Type.DEDUCTION, concept="Salud (empleado)",
                amount=health, source=PayrollItem.Source.SYSTEM, concept_code="HEALTH",
            ))

        pension = pension_deduction_for(period_base_salary, legal_parameter) if legal_parameter else Decimal("0")
        if pension > 0:
            new_items.append(PayrollItem(
                payroll=payroll, item_type=PayrollItem.Type.DEDUCTION, concept="Pensión (empleado)",
                amount=pension, source=PayrollItem.Source.SYSTEM, concept_code="PENSION",
            ))

        PayrollItem.objects.bulk_create(new_items)

        all_items = list(payroll.items.all())
        gross = sum((i.amount for i in all_items if i.item_type == PayrollItem.Type.EARNING), Decimal("0"))
        deductions_total = sum((i.amount for i in all_items if i.item_type == PayrollItem.Type.DEDUCTION), Decimal("0"))

        payroll.worked_days = worked_days
        payroll.ordinary_hours = (Decimal(ordinary_minutes) / Decimal(60)).quantize(Decimal("0.01"))
        payroll.overtime_hours = overtime_hours
        payroll.transport_allowance = transport
        payroll.health_deduction = health
        payroll.pension_deduction = pension
        payroll.gross_earnings = gross
        payroll.total_deductions = deductions_total
        payroll.bonuses = sum(
            (i.amount for i in all_items if i.item_type == PayrollItem.Type.EARNING and i.source == PayrollItem.Source.MANUAL),
            Decimal("0"),
        )
        payroll.deductions = deductions_total
        payroll.net_salary = (gross - deductions_total).quantize(Decimal("0.01"))
        if not payroll.payslip_number:
            payroll.payslip_number = self._generate_payslip_number(period)
        payroll.save()
        return payroll

    def _accumulate_recharge_minutes(self, employee, period, holiday_dates, rates=None) -> dict:
        """Recorre cada día del período con asistencia consolidada y acumula
        minutos por (label, surcharge_pct) usando classify_shift, solo para
        el tramo que cabe dentro del horario esperado del dia. El exceso se
        liquida aparte en _attendance_overtime_items."""
        totals: dict[tuple, int] = {}
        cursor = period.period_start
        while cursor <= period.period_end:
            attendance = Attendance.objects.filter(employee=employee, date=cursor).first()
            if attendance and attendance.check_in and attendance.check_out:
                schedule = get_schedule_for(employee, cursor)
                expected_minutes = schedule.expected_minutes_for(cursor.weekday()) if schedule else 0

                segments = self._work_segments(attendance)
                worked_minutes_seen = 0
                for seg_start, seg_end in segments:
                    seg_minutes = int((seg_end - seg_start).total_seconds() // 60)
                    if seg_minutes <= 0:
                        continue
                    remaining_ordinary = max(expected_minutes - worked_minutes_seen, 0)
                    if remaining_ordinary <= 0:
                        worked_minutes_seen += seg_minutes
                        continue
                    ordinary_end_offset = min(remaining_ordinary, seg_minutes)
                    ordinary_seg_end = seg_start + timedelta(minutes=ordinary_end_offset)
                    for label, pct, minutes in self._classify_range(seg_start, ordinary_seg_end, holiday_dates, is_extra=False, rates=rates):
                        key = (label, pct)
                        totals[key] = totals.get(key, 0) + minutes
                    worked_minutes_seen += seg_minutes
            cursor += timedelta(days=1)
        return totals

    def _work_segments(self, attendance) -> list:
        """[(inicio, fin)] de tramos trabajados de un Attendance consolidado,
        excluyendo el descanso si está registrado."""
        if attendance.break_start and attendance.break_end:
            return [
                (attendance.check_in, attendance.break_start),
                (attendance.break_end, attendance.check_out),
            ]
        return [(attendance.check_in, attendance.check_out)]

    def _classify_range(self, start_dt, end_dt, holiday_dates, is_extra, rates=None):
        segments = classify_shift(start_dt, end_dt, is_extra=is_extra, holiday_dates=holiday_dates, rates=rates)
        return [(seg["label"], seg["surcharge_pct"], seg["minutes"]) for seg in segments]

    def _count_worked_days(self, employee, period) -> tuple:
        worked_days = 0
        ordinary_minutes = 0
        cursor = period.period_start
        while cursor <= period.period_end:
            attendance = Attendance.objects.filter(employee=employee, date=cursor).first()
            if attendance and attendance.check_in and attendance.check_out:
                worked_days += 1
                schedule = get_schedule_for(employee, cursor)
                expected_minutes = schedule.expected_minutes_for(cursor.weekday()) if schedule else None
                remaining_ordinary = expected_minutes if expected_minutes is not None else None
                segments = self._work_segments(attendance)
                for seg_start, seg_end in segments:
                    seg_minutes = max(int((seg_end - seg_start).total_seconds() // 60), 0)
                    if remaining_ordinary is None:
                        ordinary_minutes += seg_minutes
                        continue
                    ordinary_in_segment = min(max(remaining_ordinary, 0), seg_minutes)
                    ordinary_minutes += ordinary_in_segment
                    remaining_ordinary -= ordinary_in_segment
            cursor += timedelta(days=1)
        return worked_days, ordinary_minutes

    def _approved_overtime_items(self, payroll, employee, period, hourly_rate, holiday_dates, new_items, rates=None) -> tuple:
        """Genera devengados de horas extra SOLO a partir de solicitudes
        formales aprobadas — nunca a partir de exceso de marcación cruda."""
        overtime_requests = VacationRequest.objects.filter(
            employee=employee,
            request_type=VacationRequest.RequestType.OVERTIME,
            status__in=(VacationRequest.Status.APPROVED, VacationRequest.Status.FINALIZED),
            start_date__lte=period.period_end,
            end_date__gte=period.period_start,
        ).prefetch_related("overtime_shifts")

        totals: dict[tuple, int] = {}
        total_minutes = 0
        overtime_dates = set()
        for request in overtime_requests:
            for shift in request.overtime_shifts.all():
                if shift.date < period.period_start or shift.date > period.period_end:
                    continue
                overtime_dates.add(shift.date)
                shift_start = datetime.combine(shift.date, shift.start_time)
                shift_end = datetime.combine(shift.date, shift.end_time)
                for label, pct, minutes in self._classify_range(shift_start, shift_end, holiday_dates, is_extra=True, rates=rates):
                    key = (label, pct)
                    totals[key] = totals.get(key, 0) + minutes
                    total_minutes += minutes

        overtime_amount = Decimal("0")
        for (label, pct), minutes in totals.items():
            if minutes <= 0:
                continue
            hours = Decimal(minutes) / Decimal(60)
            amount = (hourly_rate * (Decimal(100) + pct) / Decimal(100) * hours).quantize(Decimal("0.01"))
            if amount <= 0:
                continue
            overtime_amount += amount
            new_items.append(PayrollItem(
                payroll=payroll,
                item_type=PayrollItem.Type.EARNING,
                concept=f"{label} ({100 + pct:.0f}%)",
                amount=amount,
                source=PayrollItem.Source.ATTENDANCE,
                concept_code=RECHARGE_LABEL_TO_CONCEPT_CODE.get(label, "OTHER_HOURS"),
            ))

        overtime_hours = (Decimal(total_minutes) / Decimal(60)).quantize(Decimal("0.01"))
        return overtime_amount, overtime_hours, overtime_dates

    def _attendance_overtime_items(
        self,
        payroll,
        employee,
        period,
        hourly_rate,
        holiday_dates,
        new_items,
        rates=None,
        skip_dates=None,
    ) -> tuple:
        """Liquida extras desde asistencia cuando las marcas superan el horario
        esperado del dia. Si ese dia ya tiene una solicitud de extra aprobada,
        se omite para no duplicar el pago."""
        totals: dict[tuple, int] = {}
        total_minutes = 0
        skip_dates = skip_dates or set()
        cursor = period.period_start
        while cursor <= period.period_end:
            if cursor in skip_dates:
                cursor += timedelta(days=1)
                continue

            attendance = Attendance.objects.filter(employee=employee, date=cursor).first()
            if not attendance or not attendance.check_in or not attendance.check_out:
                cursor += timedelta(days=1)
                continue

            schedule = get_schedule_for(employee, cursor)
            if not schedule:
                cursor += timedelta(days=1)
                continue

            remaining_ordinary = schedule.expected_minutes_for(cursor.weekday())
            for seg_start, seg_end in self._work_segments(attendance):
                seg_minutes = max(int((seg_end - seg_start).total_seconds() // 60), 0)
                if seg_minutes <= 0:
                    continue
                ordinary_in_segment = min(max(remaining_ordinary, 0), seg_minutes)
                extra_start = seg_start + timedelta(minutes=ordinary_in_segment)
                remaining_ordinary -= ordinary_in_segment
                if extra_start >= seg_end:
                    continue
                for label, pct, minutes in self._classify_range(extra_start, seg_end, holiday_dates, is_extra=True, rates=rates):
                    key = (label, pct)
                    totals[key] = totals.get(key, 0) + minutes
                    total_minutes += minutes
            cursor += timedelta(days=1)

        overtime_amount = Decimal("0")
        for (label, pct), minutes in totals.items():
            if minutes <= 0:
                continue
            hours = Decimal(minutes) / Decimal(60)
            amount = (hourly_rate * (Decimal(100) + pct) / Decimal(100) * hours).quantize(Decimal("0.01"))
            if amount <= 0:
                continue
            overtime_amount += amount
            new_items.append(PayrollItem(
                payroll=payroll,
                item_type=PayrollItem.Type.EARNING,
                concept=f"{label} asistencia ({100 + pct:.0f}%)",
                amount=amount,
                source=PayrollItem.Source.ATTENDANCE,
                concept_code=RECHARGE_LABEL_TO_CONCEPT_CODE.get(label, "OTHER_HOURS"),
            ))

        overtime_hours = (Decimal(total_minutes) / Decimal(60)).quantize(Decimal("0.01"))
        return overtime_amount, overtime_hours

    def _vacation_request_items(self, payroll, employee, period, actor) -> list:
        """Novedades de VacationRequest aprobadas del período: vacaciones
        remuneradas, permisos no remunerados, incapacidades (informativas),
        y cuotas de préstamo pendientes."""
        items: list[PayrollItem] = []
        requests = VacationRequest.objects.filter(
            employee=employee,
            status__in=(VacationRequest.Status.APPROVED, VacationRequest.Status.FINALIZED),
            start_date__lte=period.period_end,
            end_date__gte=period.period_start,
        )

        for request in requests:
            overlap_start = max(request.start_date, period.period_start)
            overlap_end = min(request.end_date, period.period_end)
            overlap_days = (overlap_end - overlap_start).days + 1
            if overlap_days <= 0:
                continue

            if request.request_type == VacationRequest.RequestType.VACATION:
                if request.is_remunerated is not True:
                    continue
                daily_rate = daily_rate_for(employee, overlap_start)
                items.append(PayrollItem(
                    payroll=payroll,
                    item_type=PayrollItem.Type.EARNING,
                    concept=f"Vacaciones ({overlap_days} día(s))",
                    amount=(daily_rate * overlap_days).quantize(Decimal("0.01")),
                    source=PayrollItem.Source.VACATION_REQUEST,
                    source_vacation_request=request,
                    concept_code="VACATION_PAY",
                ))
            elif request.request_type == VacationRequest.RequestType.INCAPACITY:
                items.append(PayrollItem(
                    payroll=payroll,
                    item_type=PayrollItem.Type.EARNING,
                    concept=f"Incapacidad ({overlap_days} día(s)) — requiere verificación manual del régimen aplicable",
                    amount=Decimal("0"),
                    source=PayrollItem.Source.VACATION_REQUEST,
                    source_vacation_request=request,
                    concept_code="INCAPACITY_DAYS",
                ))
            elif (
                request.request_type == VacationRequest.RequestType.PERMISSION
                and request.subtype == VacationRequest.RequestSubtype.UNPAID
            ):
                daily_rate = daily_rate_for(employee, overlap_start)
                items.append(PayrollItem(
                    payroll=payroll,
                    item_type=PayrollItem.Type.DEDUCTION,
                    concept=f"Permiso no remunerado ({overlap_days} día(s))",
                    amount=(daily_rate * overlap_days).quantize(Decimal("0.01")),
                    source=PayrollItem.Source.VACATION_REQUEST,
                    source_vacation_request=request,
                    concept_code="UNPAID_LEAVE",
                ))
            elif request.request_type == VacationRequest.RequestType.LOAN:
                installment = self._loan_installment_due(request, period)
                if installment > 0:
                    items.append(PayrollItem(
                        payroll=payroll,
                        item_type=PayrollItem.Type.DEDUCTION,
                        concept=f"Cuota préstamo {request.loan_expense_number or request.request_number}",
                        amount=installment,
                        source=PayrollItem.Source.LOAN_INSTALLMENT,
                        source_vacation_request=request,
                        concept_code="LOAN_INSTALLMENT",
                    ))
        return items

    def _loan_installment_due(self, loan_request, period) -> Decimal:
        approved_amount = loan_request.loan_approved_amount or loan_request.loan_amount
        installments_count = loan_request.loan_installments_count
        if not approved_amount or not installments_count:
            return Decimal("0")

        installments_paid = PayrollItem.objects.filter(
            source=PayrollItem.Source.LOAN_INSTALLMENT,
            source_vacation_request=loan_request,
        ).exclude(payroll__period=period).count()
        if installments_paid >= installments_count:
            return Decimal("0")

        if loan_request.loan_frequency == VacationRequest.LoanFrequency.MONTHLY:
            # Solo se descuenta en la quincena que contiene el día 1 del mes
            # (primera quincena) — evita descontar dos veces en el mismo mes
            # cuando la nómina es quincenal pero el préstamo es mensual.
            if period.period_start.day > 15:
                return Decimal("0")

        return (Decimal(approved_amount) / Decimal(installments_count)).quantize(Decimal("0.01"))

    def _generate_payslip_number(self, period) -> str:
        prefix = f"NOM-{period.period_start:%Y%m}"
        next_number = Payroll.all_objects.filter(payslip_number__startswith=f"{prefix}-").count() + 1
        while True:
            candidate = f"{prefix}-{next_number:04d}"
            if not Payroll.all_objects.filter(payslip_number=candidate).exists():
                return candidate
            next_number += 1


class CalculatePayrollPeriod:
    """Calcula la nómina de todos los empleados activos de un período,
    acumulando errores por empleado sin abortar todo el período — un
    empleado con datos incompletos no debe bloquear a los demás."""

    @transaction.atomic
    def execute(self, *, period, actor=None, employee_queryset=None):
        from apps.employees.infrastructure.models import Employee

        if employee_queryset is None:
            employee_queryset = Employee.objects.filter(status=Employee.Status.ACTIVE)

        errors = []
        calculated = 0
        for employee in employee_queryset:
            try:
                CalculateEmployeePayrollForPeriod().execute(period=period, employee=employee, actor=actor)
                calculated += 1
            except BusinessRuleViolation as exc:
                errors.append({"employee_id": str(employee.id), "employee": str(employee), "error": str(exc)})

        period.status = PayrollPeriod.Status.CALCULATED
        period.calculated_at = timezone.now()
        period.calculated_by = actor if getattr(actor, "is_authenticated", False) else None
        period.save(update_fields=("status", "calculated_at", "calculated_by", "updated_at"))
        return {"period": period, "calculated": calculated, "errors": errors}


class ApprovePayrollPeriod:
    """Aprueba un período completo, tras validar (acumulando errores, mismo
    patrón que ReleaseBatch en manufacturing) que no queden ambigüedades
    pendientes: ninguna VacationRequest de vacaciones con is_remunerated=None
    sin resolver dentro del período, y que exista al menos un Payroll
    calculado."""

    @transaction.atomic
    def execute(self, *, period, actor=None):
        errors = []
        payrolls = list(period.payrolls.all())
        if not payrolls:
            errors.append("El período no tiene ninguna nómina calculada todavía.")

        pending_remuneration = VacationRequest.objects.filter(
            request_type=VacationRequest.RequestType.VACATION,
            status__in=(VacationRequest.Status.APPROVED, VacationRequest.Status.FINALIZED),
            is_remunerated__isnull=True,
            start_date__lte=period.period_end,
            end_date__gte=period.period_start,
        )
        if pending_remuneration.exists():
            errors.append(
                "Hay solicitudes de vacaciones dentro del período sin definir si son remuneradas. "
                "Resuélvelas antes de aprobar el período."
            )

        for payroll in payrolls:
            if payroll.net_salary < 0:
                errors.append(f"La nómina de {payroll.employee} tiene salario neto negativo sin justificar.")

        if errors:
            raise BusinessRuleViolation(" ".join(errors))

        for payroll in payrolls:
            payroll.status = Payroll.Status.APPROVED
            payroll.approved_by = actor if getattr(actor, "is_authenticated", False) else None
            payroll.approved_at = timezone.now()
            payroll.save(update_fields=("status", "approved_by", "approved_at", "updated_at"))

        period.status = PayrollPeriod.Status.APPROVED
        period.approved_at = timezone.now()
        period.approved_by = actor if getattr(actor, "is_authenticated", False) else None
        period.save(update_fields=("status", "approved_at", "approved_by", "updated_at"))
        return period


class MarkPayrollPeriodAsPaid:
    """Marca un período aprobado como pagado. Requiere el mismo permiso de
    edición de nómina que calcular/aprobar (confirmado: no se separa un rol
    de Tesorería aparte para esto, a diferencia de préstamos)."""

    @transaction.atomic
    def execute(self, *, period, actor=None, payment_reference=""):
        if period.status != PayrollPeriod.Status.APPROVED:
            raise BusinessRuleViolation("Solo se puede marcar como pagado un período que ya esté Aprobado.")

        now = timezone.now()
        for payroll in period.payrolls.all():
            payroll.status = Payroll.Status.PAID
            payroll.paid_at = now
            payroll.payment_reference = payment_reference
            payroll.save(update_fields=("status", "paid_at", "payment_reference", "updated_at"))

        period.status = PayrollPeriod.Status.PAID
        period.paid_at = now
        period.paid_by = actor if getattr(actor, "is_authenticated", False) else None
        period.save(update_fields=("status", "paid_at", "paid_by", "updated_at"))
        return period


class AddManualPayrollItem:
    """Ajuste manual (bono, descuento puntual no cubierto por el motor) —
    solo permitido mientras la nómina siga en borrador."""

    def execute(self, *, payroll, item_type, concept, amount, actor=None, concept_code=""):
        if payroll.status != Payroll.Status.DRAFT:
            raise BusinessRuleViolation("Solo se pueden agregar ítems manuales a una nómina en borrador.")
        if item_type not in (PayrollItem.Type.EARNING, PayrollItem.Type.DEDUCTION):
            raise BusinessRuleViolation("Tipo de ítem inválido.")
        if not concept or not concept.strip():
            raise BusinessRuleViolation("Debes indicar el concepto.")
        try:
            amount = Decimal(str(amount))
        except Exception as exc:
            raise BusinessRuleViolation("El monto no es válido.") from exc
        if amount <= 0:
            raise BusinessRuleViolation("El monto debe ser mayor que cero.")

        item = PayrollItem.objects.create(
            payroll=payroll,
            item_type=item_type,
            concept=concept,
            amount=amount,
            source=PayrollItem.Source.MANUAL,
            concept_code=concept_code,
        )

        all_items = list(payroll.items.all())
        gross = sum((i.amount for i in all_items if i.item_type == PayrollItem.Type.EARNING), Decimal("0"))
        deductions_total = sum((i.amount for i in all_items if i.item_type == PayrollItem.Type.DEDUCTION), Decimal("0"))
        payroll.gross_earnings = gross
        payroll.total_deductions = deductions_total
        payroll.deductions = deductions_total
        payroll.net_salary = (payroll.base_salary + gross - deductions_total).quantize(Decimal("0.01"))
        payroll.save(update_fields=("gross_earnings", "total_deductions", "deductions", "net_salary", "updated_at"))
        return item
