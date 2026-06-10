from .models import AuditLog


class AuditContextMiddleware:
    TRACKED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.method in self.TRACKED_METHODS and response.status_code < 500:
            forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
            ip_address = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")
            try:
                AuditLog.objects.create(
                    actor=request.user if getattr(request.user, "is_authenticated", False) else None,
                    module=self._module_from_path(request.path),
                    action=request.method,
                    request_path=request.path,
                    ip_address=ip_address,
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                    metadata={"status_code": response.status_code},
                )
            except Exception:
                pass
        return response

    @staticmethod
    def _module_from_path(path):
        parts = [part for part in path.split("/") if part]
        return parts[2] if len(parts) > 2 else "system"
