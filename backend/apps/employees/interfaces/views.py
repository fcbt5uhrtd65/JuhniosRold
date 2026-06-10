from apps.identity.interfaces.permissions import IsAdministrator
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.models import Department, Employee, EmploymentContract, Position
from ..infrastructure.serializers import ContractSerializer, DepartmentSerializer, EmployeeSerializer, PositionSerializer


class DepartmentViewSet(SoftDeleteModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = (IsAdministrator,)
    search_fields = ("name",)


class PositionViewSet(SoftDeleteModelViewSet):
    queryset = Position.objects.select_related("department")
    serializer_class = PositionSerializer
    permission_classes = (IsAdministrator,)
    filterset_fields = ("department", "is_active")
    search_fields = ("name",)


class EmployeeViewSet(SoftDeleteModelViewSet):
    queryset = Employee.objects.select_related("department", "position", "manager").prefetch_related("contracts")
    serializer_class = EmployeeSerializer
    permission_classes = (IsAdministrator,)
    filterset_fields = ("department", "position", "status")
    search_fields = ("employee_code", "document_number", "first_name", "last_name", "email")
    ordering_fields = ("hire_date", "first_name", "last_name")


class ContractViewSet(SoftDeleteModelViewSet):
    queryset = EmploymentContract.objects.select_related("employee")
    serializer_class = ContractSerializer
    permission_classes = (IsAdministrator,)
    filterset_fields = ("employee", "contract_type", "is_active")
