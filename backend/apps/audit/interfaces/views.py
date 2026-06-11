from rest_framework import mixins, viewsets

from apps.identity.interfaces.permissions import HasComponentAccess

from ..infrastructure.models import AuditLog
from ..infrastructure.serializers import AuditLogSerializer


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.select_related("actor")
    serializer_class = AuditLogSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "audit.logs"
    filterset_fields = ("module", "action", "actor")
    search_fields = ("resource_type", "resource_id", "request_path", "actor__email")
    ordering_fields = ("created_at",)
