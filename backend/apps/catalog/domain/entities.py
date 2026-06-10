from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass
class ProductVariantEntity:
    id: UUID
    sku: str
    name: str
    price: Decimal
    is_active: bool = True


@dataclass
class ProductEntity:
    id: UUID
    name: str
    slug: str
    variants: list[ProductVariantEntity]
    is_active: bool = True
