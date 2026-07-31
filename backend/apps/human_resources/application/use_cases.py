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
    PublicHoliday,
    RawBiometricPunch,
    VacationRequest,
    VacationRequestApprovalStep,
    VacationRequestHistory,
)

BIOMETRIC_DEDUP_WINDOW_MINUTES = 1


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
        elif is_loan:
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


class SetEmployeeWorkSchedule:
    """Reemplaza el horario vigente de un empleado a partir de una fecha:
    cierra (end_date = start_date - 1 día) cualquier EmployeeWorkSchedule
    activo previo que se solape, y crea la cabecera nueva con sus franjas por
    día en una sola transacción — mismo espíritu que EmployeeSalaryHistory
    (vigencia por rango de fechas, nunca se borra el horario anterior)."""

    @transaction.atomic
    def execute(self, *, employee, start_date, days_data, actor=None, notes=""):
        if not days_data:
            raise BusinessRuleViolation("Debes indicar al menos un día de horario.")

        try:
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        except (TypeError, ValueError) as exc:
            raise BusinessRuleViolation("La fecha de inicio debe tener formato YYYY-MM-DD.") from exc

        parsed_days = []
        for entry in days_data:
            weekday = entry.get("weekday")
            start_time = entry.get("expected_start_time")
            end_time = entry.get("expected_end_time")
            if weekday is None or not (0 <= int(weekday) <= 6):
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
            parsed_days.append({
                "weekday": int(weekday),
                "slot": int(entry.get("slot", 1)),
                "expected_start_time": start_time,
                "expected_end_time": end_time,
                "is_working_day": entry.get("is_working_day", True),
            })

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
        )
        EmployeeWorkScheduleDay.objects.bulk_create([
            EmployeeWorkScheduleDay(schedule=schedule, **entry) for entry in parsed_days
        ])
        return schedule


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
    def execute(self, *, file, actor=None, device=None):
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

        active_mappings = {
            mapping.biometric_code: mapping.employee_id
            for mapping in EmployeeBiometricId.objects.filter(is_active=True, device=device)
        }

        error_lines = [row for row in rows if "error" in row]
        valid_rows = [row for row in rows if "error" not in row]

        punches = []
        for row in valid_rows:
            employee_id = active_mappings.get(row["biometric_code"])
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
        created_punches = RawBiometricPunch.objects.bulk_create(punches)

        duplicate_count = self._mark_duplicates(created_punches)

        matched_count = sum(1 for p in created_punches if p.matched_employee_id)
        unmatched_count = len(created_punches) - matched_count

        batch.total_rows = len(rows)
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

    def _mark_duplicates(self, punches) -> int:
        """Agrupa por empleado resuelto y marca como duplicadas las
        marcaciones consecutivas separadas por menos de
        BIOMETRIC_DEDUP_WINDOW_MINUTES, conservando la primera de cada grupo
        como canónica. No borra ninguna fila."""
        by_employee: dict[str, list] = {}
        for punch in punches:
            if not punch.matched_employee_id:
                continue
            by_employee.setdefault(punch.matched_employee_id, []).append(punch)

        window = timedelta(minutes=BIOMETRIC_DEDUP_WINDOW_MINUTES)
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
    """Agrupa las marcaciones no-duplicadas de un lote de importación por
    (empleado, fecha) e infiere entrada/salida/descansos, creando o
    actualizando la fila Attendance consolidada de ese día.

    Regla de inferencia (deliberadamente simple y editable a mano después,
    dado que las marcaciones olvidadas/incompletas son el caso esperado, no
    la excepción):
      - 2 marcaciones: la más temprana = check_in, la más tardía = check_out.
      - 4 marcaciones: 1a=check_in, 2a=break_start, 3a=break_end, 4a=check_out.
      - 1 marcación: se infiere por hora (antes/después de mediodía), pero
        siempre queda has_incomplete_marks=True (inferencia débil).
      - 3 o más de 4: 1a=check_in, última=check_out, sin forzar descansos
        intermedios, has_incomplete_marks=True.

    Si el Attendance del día ya fue corregido manualmente
    (is_manually_corrected=True), NO se sobreescribe — la corrección humana
    siempre gana sobre una reimportación/reconsolidación."""

    @transaction.atomic
    def execute(self, *, import_batch, actor=None):
        punches = list(
            import_batch.punches.filter(is_duplicate=False, matched_employee__isnull=False).order_by(
                "matched_employee_id", "punched_at"
            )
        )

        by_employee_day: dict[tuple, list] = {}
        for punch in punches:
            key = (punch.matched_employee_id, punch.punched_at.date())
            by_employee_day.setdefault(key, []).append(punch)

        created = 0
        updated = 0
        skipped_corrected = 0
        incomplete = 0

        for (employee_id, day), day_punches in by_employee_day.items():
            day_punches.sort(key=lambda p: p.punched_at)
            existing = Attendance.objects.filter(employee_id=employee_id, date=day).first()
            if existing and existing.is_manually_corrected:
                skipped_corrected += 1
                continue

            values = self._infer_attendance(day_punches)
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

    def _infer_attendance(self, day_punches) -> dict:
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
            is_morning = only.hour < 12
            return {
                "check_in": only if is_morning else None,
                "check_out": only if not is_morning else None,
                "break_start": None, "break_end": None,
                "has_incomplete_marks": True,
            }
        # 3, o 5+: se guarda primera/última sin forzar descansos intermedios.
        return {
            "check_in": times[0], "check_out": times[-1],
            "break_start": None, "break_end": None,
            "has_incomplete_marks": True,
        }


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
