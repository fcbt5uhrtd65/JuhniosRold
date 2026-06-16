from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet
from django.db.models import Count

from ..infrastructure.models import (
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
from ..infrastructure.serializers import (
    BranchSerializer,
    ContractSerializer,
    DepartmentSerializer,
    EmployeeChangeLogSerializer,
    EmployeePositionHistorySerializer,
    EmployeeSalaryHistorySerializer,
    EmployeeSerializer,
    HRFieldConfigurationSerializer,
    PositionSerializer,
    WorkDaySerializer,
)


class DepartmentViewSet(SoftDeleteModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    search_fields = ("name",)

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class PositionViewSet(SoftDeleteModelViewSet):
    queryset = Position.objects.select_related("department")
    serializer_class = PositionSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("department", "is_active")
    search_fields = ("name",)

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class BranchViewSet(SoftDeleteModelViewSet):
    queryset = Branch.objects.select_related("responsible").annotate(employee_count=Count("employees", distinct=True))
    serializer_class = BranchSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("is_active", "status", "city", "department", "country", "responsible")
    search_fields = ("code", "name", "address", "city", "department", "country", "email", "responsible__first_name", "responsible__last_name")
    ordering_fields = ("name", "code", "city", "department", "status", "created_at")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class WorkDayViewSet(SoftDeleteModelViewSet):
    queryset = WorkDay.objects.all()
    serializer_class = WorkDaySerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("is_active",)
    search_fields = ("code", "name")
    ordering_fields = ("sort_order", "name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class HRFieldConfigurationViewSet(SoftDeleteModelViewSet):
    queryset = HRFieldConfiguration.objects.all()
    serializer_class = HRFieldConfigurationSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("section", "is_required", "is_active")
    search_fields = ("field_name", "label", "help_text")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class EmployeeViewSet(SoftDeleteModelViewSet):
    queryset = (
        Employee.objects.select_related(
            "department",
            "position",
            "manager",
            "branch",
            "created_by",
            "updated_by",
        )
        .prefetch_related("contracts", "working_days")
    )
    serializer_class = EmployeeSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("department", "position", "status", "profile_status", "branch", "employment_type")
    search_fields = ("employee_code", "document_number", "first_name", "last_name", "email", "phone")
    ordering_fields = ("hire_date", "first_name", "last_name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class ContractViewSet(SoftDeleteModelViewSet):
    queryset = EmploymentContract.objects.select_related("employee")
    serializer_class = ContractSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("employee", "contract_type", "is_active")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class EmployeeChangeLogViewSet(SoftDeleteModelViewSet):
    queryset = EmployeeChangeLog.objects.select_related("employee", "changed_by")
    serializer_class = EmployeeChangeLogSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("employee", "field_name", "changed_by")
    search_fields = ("field_name", "old_value", "new_value", "employee__employee_code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class EmployeeSalaryHistoryViewSet(SoftDeleteModelViewSet):
    queryset = EmployeeSalaryHistory.objects.select_related("employee", "changed_by")
    serializer_class = EmployeeSalaryHistorySerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("employee", "changed_by")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class EmployeePositionHistoryViewSet(SoftDeleteModelViewSet):
    queryset = EmployeePositionHistory.objects.select_related("employee", "previous_position", "new_position", "changed_by")
    serializer_class = EmployeePositionHistorySerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("employee", "new_position", "changed_by")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()
