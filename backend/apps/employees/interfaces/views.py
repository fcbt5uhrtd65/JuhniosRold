from apps.identity.interfaces.permissions import HasComponentAccess
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import Department, Employee, EmploymentContract, Position
from ..infrastructure.serializers import ContractSerializer, DepartmentSerializer, EmployeeSerializer, PositionSerializer


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


class EmployeeViewSet(SoftDeleteModelViewSet):
    queryset = Employee.objects.select_related("department", "position", "manager").prefetch_related("contracts")
    serializer_class = EmployeeSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("department", "position", "status")
    search_fields = ("employee_code", "document_number", "first_name", "last_name", "email")
    ordering_fields = ("hire_date", "first_name", "last_name")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class ContractViewSet(SoftDeleteModelViewSet):
    queryset = EmploymentContract.objects.select_related("employee")
    serializer_class = ContractSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("employee", "contract_type", "is_active")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()
