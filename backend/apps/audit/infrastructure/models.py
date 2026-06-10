from django.conf import settings
from django.db import models

from shared.infrastructure.models import BaseModel


class AuditLog(BaseModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    module = models.CharField(max_length=80, db_index=True)
    action = models.CharField(max_length=80, db_index=True)
    resource_type = models.CharField(max_length=120, blank=True)
    resource_id = models.CharField(max_length=120, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    request_path = models.CharField(max_length=500, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("module", "action", "created_at")),
            models.Index(fields=("resource_type", "resource_id")),
        ]
