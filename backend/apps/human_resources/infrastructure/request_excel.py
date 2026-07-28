import io

from openpyxl import Workbook
from openpyxl.styles import Font

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
    ("estado", "Estado"),
    ("motivo", "Motivo"),
    ("monto_prestamo", "Monto préstamo"),
    ("num_egreso", "N.º egreso"),
]


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
