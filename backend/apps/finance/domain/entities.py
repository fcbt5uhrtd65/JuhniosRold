from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class FinancialEntry:
    entry_type: str
    category: str
    amount: Decimal
    occurred_on: date
