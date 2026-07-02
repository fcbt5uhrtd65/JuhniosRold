from dataclasses import dataclass


@dataclass
class ReferralCodeEntity:
    id: str
    customer_id: str
    code: str


@dataclass
class ReferralRedemptionEntity:
    id: str
    referral_code_id: str
    referrer_customer_id: str
    referred_customer_id: str
    status: str
