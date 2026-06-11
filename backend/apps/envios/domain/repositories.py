from abc import ABC, abstractmethod
from typing import Any


class EnvioRepository(ABC):
    @abstractmethod
    def get(self, envio_id):
        raise NotImplementedError

    @abstractmethod
    def get_by_order(self, pedido_id):
        raise NotImplementedError

    @abstractmethod
    def create(self, **data):
        raise NotImplementedError

    @abstractmethod
    def save(self, envio, update_fields=None):
        raise NotImplementedError


class TrackingRepository(ABC):
    @abstractmethod
    def list_for_shipment(self, envio_id):
        raise NotImplementedError

    @abstractmethod
    def add(self, **data):
        raise NotImplementedError


class ShippingGateway(ABC):
    code = "base"

    @abstractmethod
    def quote(self, *, shipment_data: dict[str, Any]) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def create_shipment(self, *, shipment_data: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_label(self, *, external_shipment_id: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def schedule_pickup(self, *, external_shipment_id: str, pickup_data: dict[str, Any]):
        raise NotImplementedError

    @abstractmethod
    def get_tracking(self, *, tracking_number: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def cancel_shipment(self, *, external_shipment_id: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def validate_webhook(self, *, payload: bytes, signature: str) -> None:
        raise NotImplementedError
