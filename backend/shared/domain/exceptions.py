class DomainError(Exception):
    default_code = "domain_error"

    def __init__(self, message, code=None):
        super().__init__(message)
        self.message = message
        self.code = code or self.default_code


class BusinessRuleViolation(DomainError):
    default_code = "business_rule_violation"


class EntityNotFound(DomainError):
    default_code = "not_found"
