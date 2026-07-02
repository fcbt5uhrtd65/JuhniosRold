from django.db import IntegrityError, transaction

from shared.domain.exceptions import BusinessRuleViolation

from ..infrastructure.models import ReferralCode, ReferralRedemption


class GetOrCreateReferralCode:
    def execute(self, customer):
        code, _ = ReferralCode.objects.get_or_create(customer=customer)
        return code


class RedeemReferralCode:
    @transaction.atomic
    def execute(self, *, code, referred_customer):
        clean_code = (code or "").strip().upper()
        if not clean_code:
            raise BusinessRuleViolation("Código de referido vacío.")

        referral_code = ReferralCode.objects.filter(code=clean_code).select_related("customer").first()
        if not referral_code:
            raise BusinessRuleViolation("El código de referido no existe.")

        if referral_code.customer_id == referred_customer.id:
            raise BusinessRuleViolation("No puedes usar tu propio código de referido.")

        if ReferralRedemption.objects.filter(referred_customer=referred_customer).exists():
            raise BusinessRuleViolation("Este cliente ya canjeó un código de referido.")

        try:
            return ReferralRedemption.objects.create(
                referral_code=referral_code,
                referrer_customer=referral_code.customer,
                referred_customer=referred_customer,
                status=ReferralRedemption.Status.PENDING,
            )
        except IntegrityError as exc:
            raise BusinessRuleViolation("Este cliente ya canjeó un código de referido.") from exc
