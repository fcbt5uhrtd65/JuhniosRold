from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .infrastructure.models import (
    Component,
    PasswordResetToken,
    Role,
    RoleComponentPermission,
    User,
)


class RoleComponentPermissionInline(admin.TabularInline):
    model = RoleComponentPermission
    extra = 0
    autocomplete_fields = ("component",)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_default", "is_superuser", "is_active")
    search_fields = ("code", "name")
    list_filter = ("is_default", "is_superuser", "is_active")
    inlines = (RoleComponentPermissionInline,)


@admin.register(Component)
class ComponentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active")
    search_fields = ("code", "name")
    list_filter = ("is_active",)


@admin.register(User)
class JuhniosUserAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "role", "is_active", "is_staff")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Datos personales", {"fields": ("first_name", "last_name", "phone", "role")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Fechas", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),
    )
    search_fields = ("email", "first_name", "last_name")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "used_at", "created_at")
    list_filter = ("expires_at", "used_at")
    search_fields = ("user__email", "token")
    list_select_related = ("user",)
    readonly_fields = ("token", "created_at", "updated_at")
