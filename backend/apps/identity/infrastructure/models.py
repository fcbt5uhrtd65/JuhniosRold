import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from apps.identity.access_control import ADMIN_ROLE_CODE, DEFAULT_ROLE_CODE
from shared.infrastructure.models import BaseModel


def get_role_model():
    from django.apps import apps

    return apps.get_model("identity", "Role")


def get_default_role():
    role_model = get_role_model()
    role, _ = role_model.all_objects.update_or_create(
        code=DEFAULT_ROLE_CODE,
        defaults={
            "name": "Cliente",
            "description": "Rol por defecto para registros públicos.",
            "is_default": True,
            "is_superuser": False,
            "deleted_at": None,
        },
    )
    return role


def get_admin_role():
    role_model = get_role_model()
    role, _ = role_model.all_objects.update_or_create(
        code=ADMIN_ROLE_CODE,
        defaults={
            "name": "Administrador",
            "description": "Acceso total al sistema.",
            "is_default": False,
            "is_superuser": True,
            "deleted_at": None,
        },
    )
    return role


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("El correo electrónico es obligatorio.")
        extra_fields.setdefault("role", get_default_role())
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", get_admin_role())
        return self.create_user(email, password, **extra_fields)


class Role(BaseModel):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_superuser = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        verbose_name = "role"
        verbose_name_plural = "roles"

    def __str__(self):
        return self.name


class Component(BaseModel):
    code = models.CharField(max_length=120, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        verbose_name = "component"
        verbose_name_plural = "components"

    def __str__(self):
        return self.name


class RoleComponentPermission(BaseModel):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="component_permissions")
    component = models.ForeignKey(Component, on_delete=models.CASCADE, related_name="role_permissions")
    can_view = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)

    class Meta(BaseModel.Meta):
        verbose_name = "role component permission"
        verbose_name_plural = "role component permissions"
        constraints = (
            models.UniqueConstraint(
                fields=("role", "component"),
                name="identity_role_component_permission_unique",
            ),
        )
        ordering = ("role__code", "component__code")

    def __str__(self):
        return f"{self.role.code} -> {self.component.code}"


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
    )
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if self.role_id is None:
            self.role = get_default_role()
            if update_fields is not None:
                update_fields = set(update_fields)
                update_fields.add("role")
        if self.role_id:
            is_admin = bool(self.role.is_superuser)
            self.is_staff = is_admin
            self.is_superuser = is_admin
            if update_fields is not None:
                update_fields = set(update_fields)
                update_fields.update({"is_staff", "is_superuser"})
        if update_fields is not None:
            kwargs["update_fields"] = tuple(update_fields)
        super().save(*args, **kwargs)

    @property
    def role_code(self):
        return self.role.code if self.role_id else ""

    @property
    def has_full_access(self):
        return bool(self.is_superuser or (self.role and self.role.is_superuser))

    def has_component_access(self, component_code: str, action: str = "view") -> bool:
        if not self.is_authenticated:
            return False
        if self.has_full_access:
            return True
        if not self.role_id:
            return False
        permission = self.role.component_permissions.select_related("component").filter(
            component__code=component_code,
            component__deleted_at__isnull=True,
        ).first()
        if not permission:
            return False
        if action == "edit":
            return permission.can_edit
        return permission.can_view

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=("deleted_at", "is_active"))


class PasswordResetToken(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.CharField(max_length=128, unique=True, default=secrets.token_urlsafe)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()
