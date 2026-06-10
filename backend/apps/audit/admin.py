from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "actor",
        "module",
        "action",
        "resource_type",
        "resource_id",
        "ip_address",
    )
    list_filter = ("module", "action", "created_at")
    search_fields = (
        "actor__email",
        "resource_type",
        "resource_id",
        "request_path",
        "ip_address",
    )
    list_select_related = ("actor",)
    date_hierarchy = "created_at"
    readonly_fields = (
        "id",
        "actor",
        "module",
        "action",
        "resource_type",
        "resource_id",
        "ip_address",
        "user_agent",
        "request_path",
        "metadata",
        "created_at",
        "updated_at",
        "deleted_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
