from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class RoleEntity:
    id: int
    name: str
    permissions: set[str] = field(default_factory=set)


@dataclass
class UserEntity:
    id: UUID
    email: str
    first_name: str
    last_name: str
    is_active: bool = True
    roles: list[RoleEntity] = field(default_factory=list)
