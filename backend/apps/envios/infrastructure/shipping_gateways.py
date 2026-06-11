from django.conf import settings

from ..domain.exceptions import ShippingGatewayNotConfigured
from ..domain.repositories import ShippingGateway


def get_shipping_gateway(provider=None) -> ShippingGateway:
    provider = (provider or settings.SHIPPING_PROVIDER).lower()
    if provider == "mock":
        from .mock_shipping_gateway import MockShippingGateway

        return MockShippingGateway()
    if provider == "envia":
        from .envia_gateway import EnviaGateway

        return EnviaGateway()
    if provider == "coordinadora":
        from .coordinadora_gateway import CoordinadoraGateway

        return CoordinadoraGateway()
    raise ShippingGatewayNotConfigured(
        f"El proveedor logístico '{provider}' no está configurado."
    )
