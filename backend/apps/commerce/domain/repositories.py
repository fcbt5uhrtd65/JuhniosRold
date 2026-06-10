from typing import Protocol

from .entities import OrderEntity


class OrderRepository(Protocol):
    def get(self, order_id) -> OrderEntity | None: ...

    def save(self, order: OrderEntity) -> OrderEntity: ...
