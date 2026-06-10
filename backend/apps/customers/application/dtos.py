from dataclasses import dataclass


@dataclass(frozen=True)
class CreateCustomerDTO:
    document_number: str
    first_name: str
    last_name: str
    email: str
