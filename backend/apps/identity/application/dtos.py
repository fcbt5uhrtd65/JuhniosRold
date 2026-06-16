from dataclasses import dataclass


@dataclass(frozen=True)
class RegisterUserDTO:
    email: str
    password: str
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    document_type: str = ""
    document_number: str = ""
