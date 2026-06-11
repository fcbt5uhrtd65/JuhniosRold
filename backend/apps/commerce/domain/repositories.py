from typing import Any, Protocol

from .entities import OrderEntity


class OrderRepository(Protocol):
    def get(self, order_id) -> OrderEntity | None: ...

    def save(self, order: OrderEntity) -> OrderEntity: ...


class PaymentGateway(Protocol):
    public_key: str

    def build_integrity_signature(
        self,
        *,
        reference: str,
        amount_in_cents: int,
        currency: str,
        expiration_time: str | None = None,
    ) -> str: ...

    def build_checkout_url(self, **parameters: Any) -> str: ...

    def validate_event(self, payload: dict, header_checksum: str = "") -> None: ...
