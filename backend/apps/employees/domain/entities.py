from dataclasses import dataclass
from datetime import date
from uuid import UUID


@dataclass
class EmployeeEntity:
    id: UUID
    employee_code: str
    full_name: str
    hire_date: date
    status: str
