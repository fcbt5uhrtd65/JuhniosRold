from django.contrib.auth.models import Group, Permission
from django.utils import timezone
from rest_framework import serializers

from ..application.dtos import RegisterUserDTO
from ..application.use_cases import RegisterUser
from .models import PasswordResetToken, User
from .tasks import send_password_reset_email


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("id", "codename", "name")


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        source="permissions",
        queryset=Permission.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Group
        fields = ("id", "name", "permissions", "permission_ids")


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source="date_joined", read_only=True)
    updated_at = serializers.SerializerMethodField()
    roles = serializers.PrimaryKeyRelatedField(
        source="groups",
        queryset=Group.objects.all(),
        many=True,
        required=False,
    )

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
            "role",
            "roles",
            "date_joined",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "date_joined")

    def get_role(self, user):
        if user.is_superuser or user.is_staff:
            return "ADMIN"
        role = user.groups.values_list("name", flat=True).first()
        return role.upper() if role else "CLIENT"

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
