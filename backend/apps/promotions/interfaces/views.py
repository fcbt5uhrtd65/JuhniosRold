from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import Promotion
from ..infrastructure.serializers import PromotionSerializer


class PromotionViewSet(SoftDeleteModelViewSet):
    queryset = Promotion.objects.select_related("product", "variant", "category")
    serializer_class = PromotionSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "catalog.management"
    filterset_fields = ("scope", "is_active", "product", "variant", "category")
    search_fields = ("name",)
    ordering_fields = ("priority", "starts_at", "created_at")
