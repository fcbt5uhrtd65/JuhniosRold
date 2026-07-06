from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from django.db.models import Q
from django.utils import timezone

from apps.promotions.infrastructure.models import Promotion


@dataclass
class PromotionResolution:
    promotion: Promotion
    original_amount: Decimal
    discounted_amount: Decimal

    @property
    def discount_percentage_display(self) -> Decimal:
        if self.original_amount <= 0:
            return Decimal("0")
        ratio = (self.original_amount - self.discounted_amount) / self.original_amount * Decimal(100)
        return ratio.quantize(Decimal("0.1"))


def get_active_promotions_for_variant(variant) -> list[Promotion]:
    now = timezone.now()
    candidates = getattr(variant, "_prefetched_promotions", None)
    if candidates is None:
        candidates = list(
            Promotion.objects.filter(
                Q(variant_id=variant.id) | Q(product_id=variant.product_id) | Q(category_id=variant.product.category_id),
                is_active=True,
                deleted_at__isnull=True,
            )
        )
    return [promo for promo in candidates if promo.is_currently_active(now)]


def resolve_best_promotion(variant, amount: Optional[Decimal]) -> Optional[PromotionResolution]:
    if amount is None:
        return None
    promos = get_active_promotions_for_variant(variant)
    if not promos:
        return None

    best: Optional[PromotionResolution] = None
    for promo in promos:
        discounted = promo.apply_to(amount)
        if best is None:
            best = PromotionResolution(promo, amount, discounted)
            continue
        if promo.priority > best.promotion.priority or (
            promo.priority == best.promotion.priority and discounted < best.discounted_amount
        ):
            best = PromotionResolution(promo, amount, discounted)
    return best
