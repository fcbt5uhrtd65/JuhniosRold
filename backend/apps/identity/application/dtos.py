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
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    latitude: float | None = None
    longitude: float | None = None
    reference: str = ""
    purchase_mode: str = "RETAIL"
    company_id_type: str = ""
    company_id_type_other: str = ""
    company_id_number: str = ""
    company_name: str = ""
    business_type: str = ""
    is_international_distributor: bool = False
    company_phone: str = ""
