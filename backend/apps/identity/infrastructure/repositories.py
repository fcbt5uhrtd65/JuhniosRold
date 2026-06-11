from ..domain.entities import RoleEntity, UserEntity
from .models import User


class DjangoUserRepository:
    def get_by_email(self, email):
        model = User.objects.select_related("role").filter(email__iexact=email, deleted_at__isnull=True).first()
        if not model:
            return None
        return UserEntity(
            id=model.id,
            email=model.email,
            first_name=model.first_name,
            last_name=model.last_name,
            is_active=model.is_active,
            role=(
                RoleEntity(
                    id=model.role.id,
                    code=model.role.code,
                    name=model.role.name,
                    is_superuser=model.role.is_superuser,
                )
                if model.role_id
                else None
            ),
        )
