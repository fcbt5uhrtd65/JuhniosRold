from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class PayrollCalculation:
    base_salary: Decimal
    bonuses: Decimal
    deductions: Decimal

    @property
    def net_salary(self):
        return self.base_salary + self.bonuses - self.deductions
