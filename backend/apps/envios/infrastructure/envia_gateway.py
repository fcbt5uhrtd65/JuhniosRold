from django.conf import settings

from ..domain.exceptions import ShippingGatewayNotConfigured
from ..domain.repositories import ShippingGateway


class EnviaGateway(ShippingGateway):
    code = "envia"

    def __init__(self):
        self.api_key = settings.ENVIA_API_KEY
        self.base_url = settings.ENVIA_API_URL

    def _not_implemented(self):
        raise ShippingGatewayNotConfigured(
            "EnviaGateway está preparado, pero aún no tiene un contrato de API configurado."
        )

    def quote(self, *, shipment_data):
        self._not_implemented()

    def create_shipment(self, *, shipment_data):
        self._not_implemented()

    def get_label(self, *, external_shipment_id):
        self._not_implemented()

    def schedule_pickup(self, *, external_shipment_id, pickup_data):
        self._not_implemented()

    def get_tracking(self, *, tracking_number):
        self._not_implemented()

    def cancel_shipment(self, *, external_shipment_id):
        self._not_implemented()

    def validate_webhook(self, *, payload, signature):
        self._not_implemented()
