from django.contrib.auth import get_user_model
from django.db import transaction

from apps.customers.infrastructure.models import Customer, CustomerAddress
from apps.referrals.application.use_cases import RedeemReferralCode
from shared.domain.exceptions import BusinessRuleViolation

from .dtos import RegisterUserDTO
from ..domain.exceptions import EmailAlreadyRegistered


def _redeem_referral_if_present(customer: Customer, referral_code: str) -> None:
    if not referral_code:
        return
    try:
        RedeemReferralCode().execute(code=referral_code, referred_customer=customer)
    except BusinessRuleViolation:
        pass


def _create_customer_address(customer: Customer, data: RegisterUserDTO) -> None:
    if data.latitude is None or data.longitude is None:
        return
    CustomerAddress.objects.create(
        customer=customer,
        address=data.address,
        city=data.city,
        state=data.state,
        country=data.country,
        latitude=data.latitude,
        longitude=data.longitude,
        reference=data.reference,
        is_default=True,
    )


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
        customer = Customer.objects.create(
            user=user,
            document_type=data.document_type or "PENDING",
            document_number=data.document_number or f"USR-{user.id.hex}",
            first_name=data.first_name or data.email.split("@")[0],
            last_name=data.last_name,
            email=user.email,
            phone=data.phone,
            address=data.address,
            city=data.city,
            purchase_mode=data.purchase_mode or Customer.PurchaseMode.RETAIL,
            company_id_type=data.company_id_type,
            company_id_type_other=data.company_id_type_other,
            company_id_number=data.company_id_number,
            company_name=data.company_name,
            business_type=data.business_type,
            is_international_distributor=data.is_international_distributor,
            company_phone=data.company_phone,
        )
        _create_customer_address(customer, data)
        _redeem_referral_if_present(customer, data.referral_code)
        return user

    @transaction.atomic
    def execute_verified(self, data: RegisterUserDTO, password_hash: str):
        user_model = get_user_model()
        if user_model.objects.filter(email__iexact=data.email).exists():
            raise EmailAlreadyRegistered("El correo ya se encuentra registrado.")
        doc = (data.document_number or "").strip()
        if doc and Customer.objects.filter(document_number__iexact=doc).exists():
            from apps.identity.domain.exceptions import DocumentNumberAlreadyRegistered
            raise DocumentNumberAlreadyRegistered("El numero de documento ya se encuentra registrado.")
        user = user_model(
            email=data.email.lower(),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
        )
        user.password = password_hash
        user.save()
        customer = Customer.objects.create(
            user=user,
            document_type=data.document_type or "PENDING",
            document_number=data.document_number or f"USR-{user.id.hex}",
            first_name=data.first_name or data.email.split("@")[0],
            last_name=data.last_name,
            email=user.email,
            phone=data.phone,
            address=data.address,
            city=data.city,
            purchase_mode=data.purchase_mode or Customer.PurchaseMode.RETAIL,
            company_id_type=data.company_id_type,
            company_id_type_other=data.company_id_type_other,
            company_id_number=data.company_id_number,
            company_name=data.company_name,
            business_type=data.business_type,
            is_international_distributor=data.is_international_distributor,
            company_phone=data.company_phone,
        )
        _create_customer_address(customer, data)
        _redeem_referral_if_present(customer, data.referral_code)
        return user
