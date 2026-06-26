from shared.domain.exceptions import BusinessRuleViolation


class EmailAlreadyRegistered(BusinessRuleViolation):
    default_code = "email_already_registered"


class DocumentNumberAlreadyRegistered(BusinessRuleViolation):
    default_code = "document_number_already_registered"
