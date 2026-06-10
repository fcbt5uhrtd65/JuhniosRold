from typing import Protocol

from .entities import EmployeeEntity


class EmployeeRepository(Protocol):
    def get(self, employee_id) -> EmployeeEntity | None: ...

    def save(self, employee: EmployeeEntity) -> EmployeeEntity: ...
