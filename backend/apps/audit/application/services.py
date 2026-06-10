from ..infrastructure.models import AuditLog


class AuditService:
    @staticmethod
    def record(*, actor, module, action, ip_address=None, resource_type="", resource_id="", metadata=None):
        return AuditLog.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            module=module,
            action=action,
            ip_address=ip_address,
            resource_type=resource_type,
            resource_id=str(resource_id or ""),
            metadata=metadata or {},
        )
