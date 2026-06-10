from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class RegisterMovementDTO:
    variant_id: UUID
    location_id: UUID
    movement_type: str
    quantity: Decimal
    reason: str = ""
