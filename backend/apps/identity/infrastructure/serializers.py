from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from apps.customers.infrastructure.models import Customer
from apps.identity.infrastructure.models import (
    Component,
    EmailVerificationCode,
    PasswordResetCode,
    PasswordResetToken,
    Role,
    RoleComponentPermission,
    User,
)

from ..application.dtos import RegisterUserDTO
from ..domain.exceptions import EmailAlreadyRegistered
from ..application.use_cases import RegisterUser
from .tasks import (
    send_password_reset_code_email,
    send_registration_verification_email,
)


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
    first_name = serializers.CharField(required=True, allow_blank=False)
    last_name = serializers.CharField(required=True, allow_blank=False)
    phone = serializers.CharField(required=False, allow_blank=True)
    document_type = serializers.CharField(required=False, allow_blank=True)
    document_number = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True)
    state = serializers.CharField(required=False, allow_blank=True)
    country = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField(required=False, allow_null=True, default=None)
    longitude = serializers.FloatField(required=False, allow_null=True, default=None)
    reference = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                {"latitude": "Debes enviar latitud y longitud juntas."}
            )
        return attrs

    def create(self, validated_data):
        if User.objects.filter(email__iexact=validated_data["email"]).exists():
            raise serializers.ValidationError(
                {"email": "El correo ya se encuentra registrado."}
            )
        document_number = validated_data.get("document_number", "").strip()
        if document_number and Customer.objects.filter(document_number=document_number).exists():
            raise serializers.ValidationError(
                {"document_number": "El numero de documento ya se encuentra registrado."}
            )

        code = EmailVerificationCode.generate_code()
        expires_at = timezone.now() + timedelta(
            minutes=settings.REGISTRATION_CODE_TTL_MINUTES
        )
        email = validated_data["email"].strip().lower()
        registration_data = {
            "email": email,
            "first_name": validated_data.get("first_name", ""),
            "last_name": validated_data.get("last_name", ""),
            "phone": validated_data.get("phone", ""),
            "document_type": validated_data.get("document_type", ""),
            "document_number": validated_data.get("document_number", ""),
            "address": validated_data.get("address", ""),
            "city": validated_data.get("city", ""),
            "state": validated_data.get("state", ""),
            "country": validated_data.get("country", ""),
            "latitude": validated_data.get("latitude"),
            "longitude": validated_data.get("longitude"),
            "reference": validated_data.get("reference", ""),
        }

        EmailVerificationCode.objects.filter(
            email__iexact=email,
            used_at__isnull=True,
        ).update(deleted_at=timezone.now())
        verification = EmailVerificationCode.objects.create(
            email=email,
            registration_data=registration_data,
            password_hash=make_password(validated_data["password"]),
            code_hash=EmailVerificationCode.hash_code(code),
            expires_at=expires_at,
        )
        send_registration_verification_email.delay(email, code)
        verification.debug_code = code
        return verification


class RegisterVerifySerializer(serializers.Serializer):
    verification_id = serializers.UUIDField()
    code = serializers.CharField(min_length=6, max_length=6)

    def validate(self, attrs):
        verification = EmailVerificationCode.objects.filter(
            pk=attrs["verification_id"],
            deleted_at__isnull=True,
        ).first()
        if not verification:
            raise serializers.ValidationError(
                {"verification_id": "La verificacion no existe."}
            )
        if not verification.is_valid:
            raise serializers.ValidationError(
                {"code": "El codigo expiro. Solicita uno nuevo."}
            )
        if verification.attempts_remaining <= 0:
            raise serializers.ValidationError(
                {"code": "Se agotaron los intentos. Solicita un nuevo codigo."}
            )

        verification.attempts += 1
        verification.save(update_fields=("attempts", "updated_at"))
        if not verification.matches(attrs["code"]):
            raise serializers.ValidationError({"code": "El codigo no es valido."})

        attrs["verification"] = verification
        return attrs

    def save(self):
        verification = self.validated_data["verification"]
        if not verification.registration_data.get("first_name", "").strip():
            raise serializers.ValidationError({"first_name": "El nombre es obligatorio."})
        if not verification.registration_data.get("last_name", "").strip():
            raise serializers.ValidationError({"last_name": "El apellido es obligatorio."})
        dto = RegisterUserDTO(
            password="",
            **verification.registration_data,
        )
        try:
            user = RegisterUser().execute_verified(dto, verification.password_hash)
        except EmailAlreadyRegistered as exc:
            raise serializers.ValidationError({"email": str(exc)}) from exc
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"document_number": "El numero de documento ya se encuentra registrado."}
            ) from exc
        verification.mark_used()
        refresh = RefreshToken.for_user(user)
        return {
            "user": user,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }


class RegisterResendCodeSerializer(serializers.Serializer):
    verification_id = serializers.UUIDField()

    def validate_verification_id(self, value):
        verification = EmailVerificationCode.objects.filter(
            pk=value,
            deleted_at__isnull=True,
        ).first()
        if not verification or verification.used_at is not None:
            raise serializers.ValidationError("La verificacion no existe.")
        if verification.sent_count >= 3:
            raise serializers.ValidationError("Ya solicitaste demasiados codigos.")
        return verification

    def save(self):
        verification = self.validated_data["verification_id"]
        code = EmailVerificationCode.generate_code()
        previous_hashes = list(verification.previous_code_hashes or [])
        previous_hashes.append(verification.code_hash)
        verification.code_hash = EmailVerificationCode.hash_code(code)
        verification.previous_code_hashes = previous_hashes[-3:]
        verification.expires_at = timezone.now() + timedelta(
            minutes=settings.REGISTRATION_CODE_TTL_MINUTES
        )
        verification.attempts = 0
        verification.sent_count += 1
        verification.save(
            update_fields=(
                "code_hash",
                "previous_code_hashes",
                "expires_at",
                "attempts",
                "sent_count",
                "updated_at",
            )
        )
        send_registration_verification_email.delay(verification.email, code)
        verification.debug_code = code
        return verification


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self):
        user = User.objects.filter(email__iexact=self.validated_data["email"]).first()
        if not user:
            return None
        code = PasswordResetCode.generate_code()
        PasswordResetCode.objects.filter(
            user=user,
            used_at__isnull=True,
        ).update(deleted_at=timezone.now())
        verification = PasswordResetCode.objects.create(
            user=user,
            code_hash=PasswordResetCode.hash_code(code),
            expires_at=timezone.now() + timedelta(
                minutes=settings.PASSWORD_RESET_CODE_TTL_MINUTES
            ),
        )
        send_password_reset_code_email.delay(user.email, code)
        verification.debug_code = code
        return verification


class PasswordResetVerifyCodeSerializer(serializers.Serializer):
    verification_id = serializers.UUIDField()
    code = serializers.CharField(min_length=6, max_length=6)

    def validate(self, attrs):
        verification = PasswordResetCode.objects.select_related("user").filter(
            pk=attrs["verification_id"],
            deleted_at__isnull=True,
        ).first()
        if not verification:
            raise serializers.ValidationError(
                {"verification_id": "La verificacion no existe."}
            )
        if not verification.is_valid:
            raise serializers.ValidationError(
                {"code": "El codigo expiro. Solicita uno nuevo."}
            )
        if verification.attempts_remaining <= 0:
            raise serializers.ValidationError(
                {"code": "Se agotaron los intentos. Solicita un nuevo codigo."}
            )

        verification.attempts += 1
        verification.save(update_fields=("attempts", "updated_at"))
        if not verification.matches(attrs["code"]):
            raise serializers.ValidationError({"code": "El codigo no es valido."})

        attrs["verification"] = verification
        return attrs

    def save(self):
        verification = self.validated_data["verification"]
        verification.mark_verified()
        token = PasswordResetToken.objects.create(
            user=verification.user,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
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
        PasswordResetCode.objects.filter(
            user=token.user,
            used_at__isnull=True,
            verified_at__isnull=False,
        ).update(used_at=timezone.now())
        return token.user
