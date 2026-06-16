from django.contrib.auth import get_user_model
from django.db import transaction

from apps.customers.infrastructure.models import Customer

from .dtos import RegisterUserDTO
from ..domain.exceptions import EmailAlreadyRegistered


class RegisterUser:
    @transaction.atomic
    def execute(self, data: RegisterUserDTO):
        user_model = get_user_model()
        if user_model.objects.filter(email__iexact=data.email).exists():
            raise EmailAlreadyRegistered("El correo ya se encuentra registrado.")
        user = user_model.objects.create_user(
            email=data.email.lower(),
            password=data.password,
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
        )
        Customer.objects.create(
            user=user,
            document_type=data.document_type or "PENDING",
            document_number=data.document_number or f"USR-{user.id.hex}",
            first_name=data.first_name or data.email.split("@")[0],
            last_name=data.last_name,
            email=user.email,
            phone=data.phone,
        )
        return user
