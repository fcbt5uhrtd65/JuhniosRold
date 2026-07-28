import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.crypto import constant_time_compare, get_random_string, salted_hmac
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
    google_id = models.CharField(max_length=128, blank=True, db_index=True)
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
        help_text="Rol principal: define la vista por defecto al iniciar sesión.",
    )
    additional_roles = models.ManyToManyField(
        Role,
        blank=True,
        related_name="users_with_additional_role",
        help_text="Roles extra que se suman al principal (ej. Contabilidad), sin reemplazarlo.",
    )
    can_view_loan_requests = models.BooleanField(
        default=False,
        help_text="Acceso puntual a solicitudes de préstamo, independiente del rol asignado.",
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
    def all_role_codes(self):
        """Código del rol principal más los de todos los roles adicionales
        asignados. Se usa para chequeos de acceso que deben reconocer cualquier
        rol que tenga el usuario, no solo el principal."""
        codes = {self.role_code} if self.role_id else set()
        if self.pk:
            codes.update(self.additional_roles.values_list("code", flat=True))
        codes.discard("")
        return codes

    @property
    def has_full_access(self):
        return bool(self.is_superuser or (self.role and self.role.is_superuser))

    @property
    def can_view_loans(self):
        """Quién puede ver solicitudes de tipo PRÉSTAMO: Administrador, RRHH, el rol
        Contabilidad (como principal o adicional), o cualquier usuario marcado
        puntualmente con `can_view_loan_requests` (excepción por persona)."""
        return bool(
            self.has_full_access
            or ("RRHH" in self.all_role_codes or "CONTABILIDAD" in self.all_role_codes)
            or self.can_view_loan_requests
        )

    def has_component_access(self, component_code: str, action: str = "view") -> bool:
        if not self.is_authenticated:
            return False
        if self.has_full_access:
            return True
        if not self.role_id:
            return False
        role_ids = [self.role_id]
        if self.pk:
            role_ids += list(self.additional_roles.values_list("id", flat=True))
        # El más permisivo entre el rol principal y los adicionales gana: basta con
        # que UNO de los roles del usuario otorgue el permiso para el componente.
        permission_field = "can_edit" if action == "edit" else "can_view"
        return RoleComponentPermission.objects.filter(
            role_id__in=role_ids,
            component__code=component_code,
            component__deleted_at__isnull=True,
            **{permission_field: True},
        ).exists()

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


class EmailVerificationCode(BaseModel):
    email = models.EmailField(db_index=True)
    registration_data = models.JSONField(default=dict)
    password_hash = models.CharField(max_length=128)
    code_hash = models.CharField(max_length=128)
    previous_code_hashes = models.JSONField(default=list)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    sent_count = models.PositiveSmallIntegerField(default=1)

    @classmethod
    def generate_code(cls):
        return get_random_string(length=6, allowed_chars="0123456789")

    @classmethod
    def hash_code(cls, code):
        return salted_hmac("identity.email_verification", str(code)).hexdigest()

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()

    @property
    def attempts_remaining(self):
        return max(0, settings.REGISTRATION_CODE_MAX_ATTEMPTS - self.attempts)

    def matches(self, code):
        incoming_hash = self.hash_code(code)
        return constant_time_compare(self.code_hash, incoming_hash) or any(
            constant_time_compare(previous_hash, incoming_hash)
            for previous_hash in self.previous_code_hashes
        )

    def mark_used(self):
        self.used_at = timezone.now()
        self.save(update_fields=("used_at", "updated_at"))


class PasswordResetCode(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_codes")
    code_hash = models.CharField(max_length=128)
    previous_code_hashes = models.JSONField(default=list)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    sent_count = models.PositiveSmallIntegerField(default=1)

    @classmethod
    def generate_code(cls):
        return get_random_string(length=6, allowed_chars="0123456789")

    @classmethod
    def hash_code(cls, code):
        return salted_hmac("identity.password_reset", str(code)).hexdigest()

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()

    @property
    def attempts_remaining(self):
        return max(0, settings.PASSWORD_RESET_CODE_MAX_ATTEMPTS - self.attempts)

    def matches(self, code):
        incoming_hash = self.hash_code(code)
        return constant_time_compare(self.code_hash, incoming_hash) or any(
            constant_time_compare(previous_hash, incoming_hash)
            for previous_hash in self.previous_code_hashes
        )

    def mark_verified(self):
        self.verified_at = timezone.now()
        self.save(update_fields=("verified_at", "updated_at"))

    def mark_used(self):
        self.used_at = timezone.now()
        self.save(update_fields=("used_at", "updated_at"))
