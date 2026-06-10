from typing import Protocol

from .entities import StockEntity


class StockRepository(Protocol):
    def get_for_update(self, variant_id, location_id) -> StockEntity: ...

    def save(self, stock: StockEntity) -> StockEntity: ...
