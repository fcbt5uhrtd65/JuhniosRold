from dataclasses import dataclass
from uuid import UUID


@dataclass
class CustomerEntity:
    id: UUID
    document_number: str
    first_name: str
    last_name: str
    email: str
    is_active: bool = True
