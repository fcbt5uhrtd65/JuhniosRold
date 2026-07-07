import io

from openpyxl import Workbook
from openpyxl.styles import Font

COLUMNS = [
    ("nombre", "Nombre"),
    ("direccion", "Direccion"),
    ("ciudad", "Ciudad"),
    ("telefono", "Telefono"),
    ("correo", "Correo"),
    ("pedidos", "Pedidos"),
]


def _row(customer):
    nombre = f"{(customer.first_name or '').strip()} {(customer.last_name or '').strip()}".strip() or "-"
    return {
        "nombre": nombre,
        "direccion": customer.address or "-",
        "ciudad": customer.city or "-",
        "telefono": customer.phone or "-",
        "correo": customer.email or "-",
        "pedidos": customer.orders_count,
    }


def render_customers_xlsx(customers):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Clientes"
    sheet.append([label for _, label in COLUMNS])
    for cell in sheet[1]:
        cell.font = Font(bold=True)

    for customer in customers:
        row = _row(customer)
        sheet.append([row[key] for key, _ in COLUMNS])

    for column_cells in sheet.columns:
        max_length = max((len(str(cell.value)) if cell.value is not None else 0) for cell in column_cells)
        sheet.column_dimensions[column_cells[0].column_letter].width = min(max_length + 2, 45)

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer
