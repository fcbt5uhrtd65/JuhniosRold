import random
import string

from django.db import models
from django.utils import timezone

from shared.infrastructure.models import BaseModel


def _generate_suffix(length=4):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


class ReferralCode(BaseModel):
    customer = models.OneToOneField(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="referral_code",
    )
    code = models.CharField(max_length=20, unique=True, blank=True)

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        if not self.code:
            seed = (self.customer.first_name or "JR").upper()
            base = "".join(ch for ch in seed if ch.isalnum())[:6] or "JR"
            candidate = f"{base}{_generate_suffix()}"
            while ReferralCode.objects.filter(code=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}{_generate_suffix()}"
            self.code = candidate
        super().save(*args, **kwargs)


class ReferralRedemption(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        VALIDATED = "VALIDATED", "Validado"
        REWARDED = "REWARDED", "Recompensado"
        REJECTED = "REJECTED", "Rechazado"

    referral_code = models.ForeignKey(
        ReferralCode, on_delete=models.CASCADE, related_name="redemptions"
    )
    referrer_customer = models.ForeignKey(
        "customers.Customer", on_delete=models.CASCADE, related_name="referrals_made"
    )
    referred_customer = models.OneToOneField(
        "customers.Customer", on_delete=models.CASCADE, related_name="referral_redemption"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    redeemed_at = models.DateTimeField(default=timezone.now)
    validated_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-redeemed_at",)

    def __str__(self):
        return f"{self.referrer_customer} -> {self.referred_customer} ({self.status})"
