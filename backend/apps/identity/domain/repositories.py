from typing import Protocol

from .entities import UserEntity


class UserRepository(Protocol):
    def get_by_email(self, email: str) -> UserEntity | None: ...

    def save(self, user: UserEntity) -> UserEntity: ...
