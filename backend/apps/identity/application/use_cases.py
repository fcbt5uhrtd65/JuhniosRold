from django.contrib.auth import get_user_model

from .dtos import RegisterUserDTO
from ..domain.exceptions import EmailAlreadyRegistered


class RegisterUser:
    def execute(self, data: RegisterUserDTO):
        user_model = get_user_model()
        if user_model.objects.filter(email__iexact=data.email).exists():
            raise EmailAlreadyRegistered("El correo ya se encuentra registrado.")
        return user_model.objects.create_user(
            email=data.email.lower(),
            password=data.password,
            first_name=data.first_name,
            last_name=data.last_name,
        )
