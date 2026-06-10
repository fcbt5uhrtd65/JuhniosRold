from shared.domain.exceptions import BusinessRuleViolation


class EmailAlreadyRegistered(BusinessRuleViolation):
    default_code = "email_already_registered"
