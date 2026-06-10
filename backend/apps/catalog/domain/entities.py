from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any
from uuid import UUID


@dataclass
class CategoryEntity:
    id: UUID
    name: str
    slug: str
    is_active: bool = True
    parent_id: UUID | None = None


@dataclass
class ProductVariantEntity:
    id: UUID
    sku: str
    name: str
    cost: Decimal
    attributes: dict[str, Any] = field(default_factory=dict)
    price: Decimal | None = None
    is_active: bool = True


@dataclass
class ProductEntity:
    id: UUID
    name: str
    slug: str
    description: str
    category: CategoryEntity
    variants: list[ProductVariantEntity] = field(default_factory=list)
    is_active: bool = True
    is_featured: bool = False
