from shared.domain.exceptions import DomainError


class DianConfigurationError(DomainError):
    default_code = "dian_configuration_error"


class DianTransientError(DomainError):
    """Error de red/timeout al hablar con Factus. Reintentable."""

    default_code = "dian_transient_error"


class DianRejectionError(DomainError):
    """Factus/DIAN rechazó el documento por datos inválidos. No reintentable automáticamente."""

    default_code = "dian_rejection_error"


class DianDuplicatePendingError(DomainError):
    """Ya existe una factura pendiente por enviar a la DIAN con esa referencia (HTTP 409).

    Según la doc de Factus, hay que eliminarla (DELETE /v2/bills/destroy/reference/:code)
    y volver a crearla.
    """

    default_code = "dian_duplicate_pending_error"
