import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font

from shared.infrastructure.pdf_letterhead import format_time_co
from .overtime_pay import hours_breakdown, summarize_shift

COLUMNS = [
    ("numero", "N.º solicitud"),
    ("empleado", "Empleado"),
    ("codigo", "Código"),
    ("area", "Área"),
    ("sede", "Sede"),
    ("tipo", "Tipo"),
    ("fecha_solicitud", "Fecha de solicitud"),
    ("fecha_inicio", "Fecha inicio"),
    ("fecha_fin", "Fecha fin"),
    ("hora_inicio", "Hora inicio"),
    ("hora_fin", "Hora fin"),
    ("dias", "Días"),
    ("horas", "Horas"),
    ("hr_extra_diurna", "Hora extra diurna"),
    ("hr_extra_nocturna", "Hora extra nocturna"),
    ("total_hr_extra", "Total horas extra"),
    ("desglose_recargo", "Desglose de recargo (horas extra)"),
    ("remunerado", "Remunerado"),
    ("accion_no_remunerado", "Acción si no es remunerado"),
    ("estado", "Estado"),
    ("motivo", "Motivo"),
    ("monto_prestamo", "Monto préstamo"),
    ("monto_aprobado", "Monto aprobado"),
    ("num_egreso", "N.º egreso"),
]


def _remunerated_label(request):
    # Las horas extra son remuneradas por definición: no requieren decisión
    # del Administrador, a diferencia de permisos/licencias.
    if request.request_type == "OVERTIME":
        return "Sí"
    if request.is_remunerated is None:
        return "Sin decidir"
    return "Sí" if request.is_remunerated else "No"


def _non_remunerated_action_label(request):
    """Para permisos/licencias marcados como NO remunerados: se descuenta de las
    horas/días del empleado, nunca de dinero. Si es remunerado, el permiso queda
    normal (ni se paga de más ni se resta). Las horas extra siempre se pagan."""
    if request.request_type == "LOAN":
        return "-"
    if request.request_type == "OVERTIME":
        return "Normal (no se descuenta ni se paga de más)"
    if request.is_remunerated is None:
        return "Sin decidir"
    if request.is_remunerated:
        return "Normal (no se descuenta ni se paga de más)"

    if request.hours_count not in (None, ""):
        return f"Descontar {float(request.hours_count):g} h de tiempo (no de salario)."
    if request.days_count not in (None, ""):
        return f"Descontar {float(request.days_count):g} día(s) de tiempo (no de salario)."
    return "Descontar el tiempo correspondiente (no de salario)."


def _shift_list(request):
    """Todos los turnos horarios de la solicitud como (fecha, inicio_dt, fin_dt).
    Para OVERTIME con múltiples turnos usa cada uno; en cualquier otro caso con
    horario parcial (start_time/end_time) usa el rango único de la solicitud."""
    shifts = list(request.overtime_shifts.all())
    if shifts:
        result = []
        for shift in shifts:
            start_dt = datetime.combine(shift.date, shift.start_time)
            end_dt = datetime.combine(shift.date, shift.end_time)
            if end_dt > start_dt:
                result.append((shift.date, start_dt, end_dt))
        return result

    if request.start_time and request.end_time:
        start_dt = datetime.combine(request.start_date, request.start_time)
        end_dt = datetime.combine(request.start_date, request.end_time)
        if end_dt > start_dt:
            return [(request.start_date, start_dt, end_dt)]
    return []


_time_label = format_time_co


def _hour_range_labels(request):
    if request.is_full_day:
        return "Jornada completa", "Jornada completa"
    shifts = _shift_list(request)
    if len(shifts) == 1:
        _, start_dt, end_dt = shifts[0]
        return _time_label(start_dt.time()), _time_label(end_dt.time())
    if len(shifts) > 1:
        return "Varios turnos", "Varios turnos"
    return _time_label(request.start_time), _time_label(request.end_time)


def _overtime_hours(request):
    """(hora_extra_diurna, hora_extra_nocturna, total) en horas decimales,
    sumando todos los turnos si hay varios. Solo aplica a tipo Horas Extra."""
    if request.request_type != "OVERTIME":
        return "-", "-", "-"

    shifts = _shift_list(request)
    if not shifts:
        return 0, 0, 0

    day_total = 0.0
    night_total = 0.0
    for _, start_dt, end_dt in shifts:
        breakdown = hours_breakdown(start_dt, end_dt, is_extra=True)
        day_total += breakdown["day_hours"]
        night_total += breakdown["night_hours"]
    return round(day_total, 2), round(night_total, 2), round(day_total + night_total, 2)


def _overtime_breakdown_label(request):
    if request.request_type != "OVERTIME":
        return "-"

    shifts = _shift_list(request)
    if not shifts:
        return "-"

    parts = [f"{shift_date:%d/%m}: {summarize_shift(start_dt, end_dt)}" for shift_date, start_dt, end_dt in shifts]
    return " | ".join(parts) if parts else "-"


def _safe(value, default="-"):
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def _employee_name(employee):
    return f"{(employee.first_name or '').strip()} {(employee.last_name or '').strip()}".strip() or _safe(employee.employee_code)


def _date(value):
    return value.strftime("%d/%m/%Y") if value else "-"


def _row(request):
    employee = request.employee
    hour_start, hour_end = _hour_range_labels(request)
    extra_day, extra_night, extra_total = _overtime_hours(request)
    return {
        "numero": request.request_number or str(request.id),
        "empleado": _employee_name(employee),
        "codigo": employee.employee_code or "-",
        "area": employee.department.name if employee.department_id else "-",
        "sede": employee.branch.name if employee.branch_id else "-",
        "tipo": request.get_request_type_display(),
        "fecha_solicitud": _date(request.created_at.date() if request.created_at else None),
        "fecha_inicio": _date(request.start_date),
        "fecha_fin": _date(request.end_date),
        "hora_inicio": hour_start,
        "hora_fin": hour_end,
        "dias": float(request.days_count) if request.days_count is not None else "-",
        "horas": float(request.hours_count) if request.hours_count is not None else "-",
        "hr_extra_diurna": extra_day,
        "hr_extra_nocturna": extra_night,
        "total_hr_extra": extra_total,
        "desglose_recargo": _overtime_breakdown_label(request),
        "remunerado": _remunerated_label(request),
        "accion_no_remunerado": _non_remunerated_action_label(request),
        "estado": request.get_status_display(),
        "motivo": request.reason or request.description or "-",
        "monto_prestamo": float(request.loan_amount) if request.loan_amount is not None else "-",
        "monto_aprobado": float(request.loan_approved_amount) if request.loan_approved_amount is not None else "-",
        "num_egreso": request.loan_expense_number or "-",
    }


def render_requests_xlsx(requests):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Solicitudes"
    sheet.append([label for _, label in COLUMNS])
    for cell in sheet[1]:
        cell.font = Font(bold=True)

    for request in requests:
        row = _row(request)
        sheet.append([row[key] for key, _ in COLUMNS])

    for column_cells in sheet.columns:
        max_length = max((len(str(cell.value)) if cell.value is not None else 0) for cell in column_cells)
        sheet.column_dimensions[column_cells[0].column_letter].width = min(max_length + 2, 45)

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer
