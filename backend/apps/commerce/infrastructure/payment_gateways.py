from .wompi_client import WompiClient


class WompiPaymentGateway:
    def __init__(self, client=None):
        self.client = client or WompiClient()

    @property
    def public_key(self):
        return self.client.public_key

    def build_integrity_signature(self, **parameters):
        return self.client.build_integrity_signature(**parameters)

    def build_checkout_url(self, **parameters):
        return self.client.build_checkout_url(**parameters)

    def validate_event(self, payload, header_checksum=""):
        return self.client.validate_event(payload, header_checksum)

    def get_transaction(self, transaction_id):
        return self.client.get_transaction(transaction_id)
