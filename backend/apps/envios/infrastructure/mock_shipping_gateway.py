import hmac
import uuid
from hashlib import sha256

from django.conf import settings

from ..domain.exceptions import ShippingGatewayError
from ..domain.repositories import ShippingGateway


class MockShippingGateway(ShippingGateway):
    code = "mock"

    def quote(self, *, shipment_data):
        return [
            {
                "service": "MOCK_STANDARD",
                "carrier": "Transportadora Mock",
                "amount": "12000.00",
                "currency": "COP",
                "estimated_days": 3,
            }
        ]

    def create_shipment(self, *, shipment_data):
        external_id = f"mock-{uuid.uuid4()}"
        tracking_number = f"MOCK{uuid.uuid4().hex[:12].upper()}"
        return {
            "external_shipment_id": external_id,
            "tracking_number": tracking_number,
            "tracking_url": f"https://tracking.example.test/{tracking_number}",
            "label_url": f"https://labels.example.test/{external_id}.pdf",
            "status": "GUIA_GENERADA",
            "raw_response": {"provider": self.code, "request": shipment_data},
        }

    def get_label(self, *, external_shipment_id):
        return {
            "label_url": f"https://labels.example.test/{external_shipment_id}.pdf"
        }

    def schedule_pickup(self, *, external_shipment_id, pickup_data):
        return {
            "external_shipment_id": external_shipment_id,
            "status": "RECOGIDA_PROGRAMADA",
            "pickup": pickup_data,
        }

    def get_tracking(self, *, tracking_number):
        return {
            "tracking_number": tracking_number,
            "status": "EN_TRANSITO",
            "events": [
                {
                    "id": f"mock-tracking-{tracking_number}",
                    "status": "EN_TRANSITO",
                    "description": "Paquete en tránsito.",
                    "location": "Centro logístico",
                }
            ],
        }

    def cancel_shipment(self, *, external_shipment_id):
        return {"external_shipment_id": external_shipment_id, "status": "CANCELADO"}

    def validate_webhook(self, *, payload, signature):
        secret = settings.SHIPPING_WEBHOOK_SECRET
        if not secret:
            raise ShippingGatewayError(
                "SHIPPING_WEBHOOK_SECRET no está configurado; el webhook logístico está deshabilitado."
            )
        expected = hmac.new(secret.encode(), payload, sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ShippingGatewayError("La firma del webhook logístico no es válida.")
