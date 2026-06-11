from dataclasses import dataclass


@dataclass(frozen=True)
class WompiCheckout:
    checkout_url: str
    reference: str
    amount_in_cents: int
    currency: str
    public_key: str
    integrity_signature: str
    redirect_url: str
