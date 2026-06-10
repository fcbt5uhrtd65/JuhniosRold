from dataclasses import dataclass
from decimal import Decimal

from .exceptions import BusinessRuleViolation


@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str = "COP"

    def __post_init__(self):
        if self.amount < 0:
            raise BusinessRuleViolation("El dinero no puede tener un valor negativo.")


@dataclass(frozen=True)
class Quantity:
    value: Decimal

    def __post_init__(self):
        if self.value < 0:
            raise BusinessRuleViolation("La cantidad no puede ser negativa.")
