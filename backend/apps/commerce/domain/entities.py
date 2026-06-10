from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass
class OrderItemEntity:
    variant_id: UUID
    quantity: Decimal
    unit_price: Decimal


@dataclass
class OrderEntity:
    id: UUID
    number: str
    status: str
    items: list[OrderItemEntity]
    total: Decimal
