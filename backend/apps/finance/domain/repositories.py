from typing import Protocol

from .entities import FinancialEntry


class FinancialRepository(Protocol):
    def save(self, entry: FinancialEntry) -> FinancialEntry: ...
