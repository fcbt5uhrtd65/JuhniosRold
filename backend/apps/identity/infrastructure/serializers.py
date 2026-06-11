from django.utils import timezone
from rest_framework import serializers

from apps.identity.infrastructure.models import (
    Component,
    PasswordResetToken,
    Role,
    RoleComponentPermission,
    User,
)

from ..application.dtos import RegisterUserDTO
from ..application.use_cases import RegisterUser
from .tasks import send_password_reset_email


class ComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Component
        fields = (
            "id",
            "code",
            "name",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class RoleComponentPermissionSerializer(serializers.ModelSerializer):
    component = ComponentSerializer(read_only=True)
    component_id = serializers.PrimaryKeyRelatedField(
        source="component",
        queryset=Component.objects.filter(deleted_at__isnull=True),
        write_only=True,
    )

    class Meta:
        model = RoleComponentPermission
        fields = (
            "id",
            "role",
            "component",
            "component_id",
            "can_view",
            "can_edit",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class RoleSerializer(serializers.ModelSerializer):
    component_permissions = RoleComponentPermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = (
            "id",
            "code",
            "name",
            "description",
            "is_superuser",
            "is_default",
            "is_active",
            "component_permissions",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "component_permissions")


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()
    role_id = serializers.PrimaryKeyRelatedField(
        source="role",
        queryset=Role.objects.filter(deleted_at__isnull=True),
        required=False,
    )
    created_at = serializers.DateTimeField(source="date_joined", read_only=True)
    updated_at = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "is_active",
            "is_staff",
            "is_superuser",
            "role",
            "role_name",
            "role_id",
            "date_joined",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "date_joined", "created_at", "updated_at", "role")

    def get_role(self, user):
        return user.role.code if user.role_id else ""

    def get_role_name(self, user):
        return user.role.name if user.role_id else ""

    def get_updated_at(self, user):
        return user.last_login or user.date_joined


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        return RegisterUser().execute(RegisterUserDTO(**validated_data))


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self):
        user = User.objects.filter(email__iexact=self.validated_data["email"]).first()
        if not user:
            return None
        token = PasswordResetToken.objects.create(user=user)
        send_password_reset_email.delay(user.email, token.token)
        return token


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_token(self, value):
        token = PasswordResetToken.objects.filter(token=value).first()
        if not token or not token.is_valid:
            raise serializers.ValidationError("El token es inválido o ha expirado.")
        return token

    def save(self):
        token = self.validated_data["token"]
        token.user.set_password(self.validated_data["new_password"])
        token.user.save(update_fields=("password",))
        token.used_at = timezone.now()
        token.save(update_fields=("used_at", "updated_at"))
        return token.user
