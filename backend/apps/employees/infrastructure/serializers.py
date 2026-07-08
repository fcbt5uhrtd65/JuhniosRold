from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.identity.infrastructure.models import Role, User

from .models import (
    Branch,
    Department,
    Employee,
    EmployeeChangeLog,
    EmployeePositionHistory,
    EmployeeSalaryHistory,
    EmploymentContract,
    HRFieldConfiguration,
    Position,
    WorkDay,
)


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = "__all__"


class BranchSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True)
    responsible_name = serializers.SerializerMethodField(read_only=True)
    department_names = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Branch
        fields = "__all__"

    def get_responsible_name(self, branch: Branch) -> str:
        return str(branch.responsible) if branch.responsible_id else ""

    def get_department_names(self, branch: Branch) -> list[str]:
        return list(
            branch.employees.exclude(department__isnull=True)
            .values_list("department__name", flat=True)
            .distinct()
        )


class WorkDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkDay
        fields = "__all__"


class HRFieldConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = HRFieldConfiguration
        fields = "__all__"


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentContract
        fields = "__all__"


class EmployeeSerializer(serializers.ModelSerializer):
    contracts = ContractSerializer(many=True, read_only=True)
    user_role_code = serializers.SerializerMethodField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    seniority_days = serializers.IntegerField(read_only=True)
    time_in_position_days = serializers.IntegerField(read_only=True)
    remaining_contract_days = serializers.IntegerField(read_only=True)
    profile_completion_percentage = serializers.IntegerField(read_only=True)
    pending_documents_count = serializers.IntegerField(read_only=True)
    expired_documents_count = serializers.IntegerField(read_only=True)
    user_role = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    user_email = serializers.EmailField(write_only=True, required=False, allow_blank=True, allow_null=True)
    user_email_confirm = serializers.EmailField(write_only=True, required=False, allow_blank=True, allow_null=True)
    user_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=False,
    )
    user_password_confirm = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=False,
    )

    TRACKED_FIELDS = (
        "profile_status",
        "document_type",
        "document_number",
        "first_name",
        "last_name",
        "email",
        "phone",
        "department_id",
        "position_id",
        "manager_id",
        "employment_type",
        "contract_type",
        "hire_date",
        "base_salary",
        "termination_date",
        "status",
        "branch_id",
        "cost_center",
        "work_modality",
        "salary_type",
    )

    class Meta:
        model = Employee
        fields = "__all__"
        read_only_fields = (
            "created_by",
            "updated_by",
            "age",
            "seniority_days",
            "time_in_position_days",
            "remaining_contract_days",
            "profile_completion_percentage",
            "pending_documents_count",
            "expired_documents_count",
        )

    def get_user_role_code(self, employee: Employee) -> str:
        if not employee.user or not employee.user.role_id:
            return ""
        return employee.user.role.code

    def validate(self, attrs):
        role_code = str(attrs.get("user_role") or "").strip().upper()
        user_email = str(attrs.get("user_email") or "").strip().lower()
        user_email_confirm = str(attrs.get("user_email_confirm") or "").strip().lower()
        password = str(attrs.get("user_password") or "")
        password_confirm = str(attrs.get("user_password_confirm") or "")
        user = attrs.get("user")
        creating_user = bool(role_code or password) and not user and not getattr(self.instance, "user_id", None)

        if "document_number" in attrs and not str(attrs.get("document_number") or "").strip():
            attrs["document_number"] = None

        if "employee_code" in attrs:
            attrs["employee_code"] = str(attrs.get("employee_code") or "").strip()

        document_number = attrs.get("document_number")
        if document_number:
            duplicated = Employee.all_objects.filter(document_number=document_number)
            if self.instance:
                duplicated = duplicated.exclude(pk=self.instance.pk)
            if duplicated.exists():
                raise serializers.ValidationError({"document_number": ["Ya existe un empleado con este número de documento."]})

        if user_email_confirm and (user_email or attrs.get("email")):
            expected_email = user_email or str(attrs.get("email") or getattr(self.instance, "email", "")).strip().lower()
            if expected_email != user_email_confirm:
                raise serializers.ValidationError({"user_email_confirm": ["La confirmación de correo no coincide."]})

        if password_confirm and password != password_confirm:
            raise serializers.ValidationError({"user_password_confirm": ["La confirmación de contraseña no coincide."]})

        if role_code and not Role.objects.filter(code=role_code, deleted_at__isnull=True).exists():
            raise serializers.ValidationError({"user_role": ["El rol enviado no existe."]})

        if creating_user and not role_code:
            raise serializers.ValidationError({"user_role": ["El rol es obligatorio cuando se crea un usuario para el empleado."]})

        if creating_user and not password:
            raise serializers.ValidationError({"user_password": ["La contraseña es obligatoria cuando se crea un usuario para el empleado."]})

        if password and len(password) < 8:
            raise serializers.ValidationError({"user_password": ["La contraseña debe tener al menos 8 caracteres."]})

        if "base_salary" in attrs and attrs["base_salary"] is not None and attrs["base_salary"] <= 0:
            raise serializers.ValidationError({"base_salary": ["El salario debe ser mayor a cero."]})

        return attrs

    def _current_user(self):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return user if getattr(user, "is_authenticated", False) else None

    def _sync_employee_user(
        self,
        employee: Employee,
        user: User | None,
        role_code: str,
        password: str,
        user_email: str,
    ) -> Employee:
        target_user = user or employee.user
        access_email = user_email or employee.email

        if not target_user and not role_code and not password:
            return employee

        if not target_user:
            role = Role.objects.get(code=role_code, deleted_at__isnull=True)
            target_user = User(
                email=access_email,
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
        target_user.email = access_email
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

    def _create_initial_history(self, employee: Employee):
        changed_by = self._current_user()
        if employee.base_salary and employee.base_salary > 0:
            EmployeeSalaryHistory.objects.create(
                employee=employee,
                previous_salary=None,
                new_salary=employee.base_salary,
                start_date=employee.hire_date or timezone.localdate(),
                changed_by=changed_by,
                reason="Registro inicial",
            )
        if employee.position_id:
            EmployeePositionHistory.objects.create(
                employee=employee,
                previous_position=None,
                new_position=employee.position,
                start_date=employee.hire_date or timezone.localdate(),
                changed_by=changed_by,
                reason="Registro inicial",
            )

    def _create_change_history(self, employee: Employee, previous_values: dict):
        changed_by = self._current_user()
        for field_name, old_value in previous_values.items():
            new_value = getattr(employee, field_name, None)
            if str(old_value or "") == str(new_value or ""):
                continue
            EmployeeChangeLog.objects.create(
                employee=employee,
                changed_by=changed_by,
                field_name=field_name,
                old_value=str(old_value or ""),
                new_value=str(new_value or ""),
            )

        previous_salary = previous_values.get("base_salary")
        if previous_salary != employee.base_salary and employee.base_salary and employee.base_salary > 0:
            EmployeeSalaryHistory.objects.create(
                employee=employee,
                previous_salary=previous_salary or None,
                new_salary=employee.base_salary,
                start_date=employee.hire_date or timezone.localdate(),
                changed_by=changed_by,
                reason="Actualización de salario",
            )

        previous_position_id = previous_values.get("position_id")
        if previous_position_id != employee.position_id and employee.position_id:
            EmployeePositionHistory.objects.create(
                employee=employee,
                previous_position_id=previous_position_id or None,
                new_position=employee.position,
                start_date=employee.hire_date or timezone.localdate(),
                changed_by=changed_by,
                reason="Cambio de cargo",
            )

    def create(self, validated_data):
        user = validated_data.pop("user", None)
        role_code = str(validated_data.pop("user_role", "") or "").strip().upper()
        user_email = str(validated_data.pop("user_email", "") or "").strip().lower()
        validated_data.pop("user_email_confirm", None)
        password = str(validated_data.pop("user_password", "") or "")
        validated_data.pop("user_password_confirm", None)
        with transaction.atomic():
            employee = super().create(validated_data)
            employee = self._sync_employee_user(employee, user, role_code, password, user_email)
            self._create_initial_history(employee)
            return employee

    def update(self, instance, validated_data):
        user = validated_data.pop("user", None)
        role_code = str(validated_data.pop("user_role", "") or "").strip().upper()
        user_email = str(validated_data.pop("user_email", "") or "").strip().lower()
        validated_data.pop("user_email_confirm", None)
        password = str(validated_data.pop("user_password", "") or "")
        validated_data.pop("user_password_confirm", None)
        previous_values = {
            field_name: getattr(instance, field_name, None)
            for field_name in self.TRACKED_FIELDS
        }
        with transaction.atomic():
            employee = super().update(instance, validated_data)
            employee = self._sync_employee_user(employee, user, role_code, password, user_email)
            self._create_change_history(employee, previous_values)
            return employee


class EmployeeSelfServiceSerializer(EmployeeSerializer):
    """Restricted variant of EmployeeSerializer for an employee editing their own profile.

    Labor and payroll data, plus the system role, are read-only here — those stay
    exclusive to RRHH/ADMIN via the regular EmployeeViewSet endpoints.
    """

    SELF_SERVICE_READ_ONLY_FIELDS = (
        "employee_code",
        "profile_status",
        "department",
        "position",
        "manager",
        "employment_type",
        "contract_type",
        "hire_date",
        "base_salary",
        "termination_date",
        "status",
        "branch",
        "cost_center",
        "work_modality",
        "termination_reason",
        "work_observations",
        "salary_type",
        "weekly_working_hours",
        "working_days",
        "transport_allowance_applies",
        "integral_salary",
    )

    def get_fields(self):
        fields = super().get_fields()
        for field_name in self.SELF_SERVICE_READ_ONLY_FIELDS:
            if field_name in fields:
                fields[field_name].read_only = True
        fields["user_role"].read_only = True
        return fields

    def validate(self, attrs):
        attrs.pop("user_role", None)
        return super().validate(attrs)


class EmployeeChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeChangeLog
        fields = "__all__"


class EmployeeSalaryHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeSalaryHistory
        fields = "__all__"


class EmployeePositionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeePositionHistory
        fields = "__all__"
