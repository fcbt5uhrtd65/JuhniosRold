from ..domain.entities import UserEntity
from .models import User


class DjangoUserRepository:
    def get_by_email(self, email):
        model = User.objects.filter(email__iexact=email, deleted_at__isnull=True).first()
        if not model:
            return None
        return UserEntity(
            id=model.id,
            email=model.email,
            first_name=model.first_name,
            last_name=model.last_name,
            is_active=model.is_active,
        )
