from django.contrib import admin

from .infrastructure.models import Notification, StaffNotification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "customer", "read", "created_at")
    list_filter = ("type", "read")
    search_fields = ("title", "message", "customer__email")
    ordering = ("-created_at",)


@admin.register(StaffNotification)
class StaffNotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "module", "employee", "notification_type", "status", "due_date", "created_at")
    list_filter = ("module", "notification_type", "status", "due_date")
    search_fields = ("title", "message", "employee__employee_code", "employee__first_name")
    list_select_related = ("employee", "document", "batch", "created_by")
