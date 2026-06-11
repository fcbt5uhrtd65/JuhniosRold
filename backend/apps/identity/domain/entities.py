from dataclasses import dataclass
from uuid import UUID


@dataclass
class RoleEntity:
    id: UUID
    code: str
    name: str
    is_superuser: bool = False


@dataclass
class UserEntity:
    id: UUID
    email: str
    first_name: str
    last_name: str
    is_active: bool = True
    role: RoleEntity | None = None
