from typing import Protocol

from .entities import CustomerEntity


class CustomerRepository(Protocol):
    def get(self, customer_id) -> CustomerEntity | None: ...

    def save(self, customer: CustomerEntity) -> CustomerEntity: ...
