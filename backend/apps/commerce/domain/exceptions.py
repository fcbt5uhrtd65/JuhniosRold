from shared.domain.exceptions import BusinessRuleViolation, DomainError


class PaymentConfigurationError(DomainError):
    default_code = "payment_configuration_error"


class InvalidWebhookSignature(DomainError):
    default_code = "invalid_webhook_signature"


class PaymentIntegrityError(BusinessRuleViolation):
    default_code = "payment_integrity_error"
