from django.contrib import admin

from .infrastructure.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "customer", "read", "created_at")
    list_filter = ("type", "read")
    search_fields = ("title", "message", "customer__email")
    ordering = ("-created_at",)
