from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from shared.domain.exceptions import BusinessRuleViolation


@dataclass
class StockEntity:
    variant_id: UUID
    location_id: UUID
    quantity: Decimal
    minimum_quantity: Decimal

    def remove(self, quantity):
        if quantity <= 0:
            raise BusinessRuleViolation("La cantidad debe ser mayor que cero.")
        if self.quantity < quantity:
            raise BusinessRuleViolation("No hay stock suficiente.")
        self.quantity -= quantity
