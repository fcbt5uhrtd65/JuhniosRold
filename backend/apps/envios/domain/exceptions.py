from shared.domain.exceptions import BusinessRuleViolation, DomainError, EntityNotFound


class EnvioNoEncontrado(EntityNotFound):
    default_code = "envio_not_found"


class EstadoEnvioInvalido(BusinessRuleViolation):
    default_code = "invalid_shipping_status"


class GuiaInvalida(BusinessRuleViolation):
    default_code = "invalid_tracking_number"


class ShippingGatewayError(DomainError):
    default_code = "shipping_gateway_error"


class ShippingGatewayNotConfigured(ShippingGatewayError):
    default_code = "shipping_gateway_not_configured"
