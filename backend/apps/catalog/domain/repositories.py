from typing import Protocol

from .entities import ProductEntity


class ProductRepository(Protocol):
    def get(self, product_id) -> ProductEntity | None: ...

    def save(self, product: ProductEntity) -> ProductEntity: ...
