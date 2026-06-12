from django.db import transaction
from rest_framework import serializers

from apps.identity.infrastructure.models import Role, User

from .models import Department, Employee, EmploymentContract, Position


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = "__all__"


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentContract
        fields = "__all__"


class EmployeeSerializer(serializers.ModelSerializer):
    contracts = ContractSerializer(many=True, read_only=True)
    user_role_code = serializers.SerializerMethodField(read_only=True)
    user_role = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    user_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=False,
    )

    class Meta:
        model = Employee
        fields = "__all__"

    def get_user_role_code(self, employee: Employee) -> str:
        if not employee.user or not employee.user.role_id:
            return ""
        return employee.user.role.code

    def validate(self, attrs):
        role_code = str(attrs.get("user_role") or "").strip().upper()
        password = str(attrs.get("user_password") or "")
        user = attrs.get("user")
        creating_user = bool(role_code or password) and not user and not getattr(self.instance, "user_id", None)

        if role_code and not Role.objects.filter(code=role_code, deleted_at__isnull=True).exists():
            raise serializers.ValidationError({"user_role": ["El rol enviado no existe."]})

        if creating_user and not role_code:
            raise serializers.ValidationError({"user_role": ["El rol es obligatorio cuando se crea un usuario para el empleado."]})

        if creating_user and not password:
            raise serializers.ValidationError({"user_password": ["La contraseña es obligatoria cuando se crea un usuario para el empleado."]})

        if password and len(password) < 8:
            raise serializers.ValidationError({"user_password": ["La contraseña debe tener al menos 8 caracteres."]})

        return attrs

    def _sync_employee_user(self, employee: Employee, user: User | None, role_code: str, password: str) -> Employee:
        target_user = user or employee.user

        if not target_user and not role_code and not password:
            return employee

        if not target_user:
            role = Role.objects.get(code=role_code, deleted_at__isnull=True)
            target_user = User(
                email=employee.email,
                first_name=employee.first_name,
                last_name=employee.last_name,
                phone=employee.phone,
                role=role,
            )
            target_user.set_password(password)
            target_user.save()
            employee.user = target_user
            employee.save(update_fields=("user", "updated_at"))
            return employee

        if role_code:
            target_user.role = Role.objects.get(code=role_code, deleted_at__isnull=True)
        target_user.email = employee.email
        target_user.first_name = employee.first_name
        target_user.last_name = employee.last_name
        target_user.phone = employee.phone
        if password:
            target_user.set_password(password)
        target_user.save()

        if employee.user_id != target_user.id:
            employee.user = target_user
            employee.save(update_fields=("user", "updated_at"))

        return employee

    def create(self, validated_data):
        user = validated_data.pop("user", None)
        role_code = str(validated_data.pop("user_role", "") or "").strip().upper()
        password = str(validated_data.pop("user_password", "") or "")
        with transaction.atomic():
            employee = super().create(validated_data)
            return self._sync_employee_user(employee, user, role_code, password)

    def update(self, instance, validated_data):
        user = validated_data.pop("user", None)
        role_code = str(validated_data.pop("user_role", "") or "").strip().upper()
        password = str(validated_data.pop("user_password", "") or "")
        with transaction.atomic():
            employee = super().update(instance, validated_data)
            return self._sync_employee_user(employee, user, role_code, password)
