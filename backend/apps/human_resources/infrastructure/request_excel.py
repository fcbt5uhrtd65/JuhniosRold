import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font

from .overtime_pay import summarize_shift

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
    ("dias", "Días"),
    ("horas", "Horas"),
    ("desglose_recargo", "Desglose de recargo (horas extra)"),
    ("remunerado", "Remunerado"),
    ("estado", "Estado"),
    ("motivo", "Motivo"),
    ("monto_prestamo", "Monto préstamo"),
    ("num_egreso", "N.º egreso"),
]


def _remunerated_label(request):
    if request.is_remunerated is None:
        return "Sin decidir"
    return "Sí" if request.is_remunerated else "No"


def _overtime_breakdown_label(request):
    if request.request_type != "OVERTIME":
        return "-"

    shifts = list(request.overtime_shifts.all())
    if shifts:
        parts = []
        for shift in shifts:
            start_dt = datetime.combine(shift.date, shift.start_time)
            end_dt = datetime.combine(shift.date, shift.end_time)
            if end_dt <= start_dt:
                continue
            parts.append(f"{shift.date:%d/%m}: {summarize_shift(start_dt, end_dt)}")
        return " | ".join(parts) if parts else "-"

    if request.start_time and request.end_time:
        start_dt = datetime.combine(request.start_date, request.start_time)
        end_dt = datetime.combine(request.start_date, request.end_time)
        if end_dt > start_dt:
            return summarize_shift(start_dt, end_dt)
    return "-"


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
        "dias": float(request.days_count) if request.days_count is not None else "-",
        "horas": float(request.hours_count) if request.hours_count is not None else "-",
        "desglose_recargo": _overtime_breakdown_label(request),
        "remunerado": _remunerated_label(request),
        "estado": request.get_status_display(),
        "motivo": request.reason or request.description or "-",
        "monto_prestamo": float(request.loan_amount) if request.loan_amount is not None else "-",
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
