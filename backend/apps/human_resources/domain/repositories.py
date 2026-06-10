from typing import Protocol


class PayrollRepository(Protocol):
    def save(self, payroll): ...
