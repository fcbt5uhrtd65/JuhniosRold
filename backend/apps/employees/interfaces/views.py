from apps.identity.interfaces.permissions import HasComponentAccess
from django.http import FileResponse
from shared.interfaces.viewsets import SoftDeleteModelViewSet
from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
    EmployeeSelfServiceSerializer,
    EmployeeSerializer,
    HRFieldConfigurationSerializer,
    PositionSerializer,
    WorkDaySerializer,
)
from ..infrastructure.employee_pdf import render_employees_pdf
from ..infrastructure.employee_profile_pdf import render_employee_profile_pdf
from ..infrastructure.branch_pdf import render_branches_pdf
from ..infrastructure.catalog_pdf import render_departments_pdf, render_positions_pdf


class DepartmentViewSet(SoftDeleteModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    search_fields = ("name",)

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve", "export_pdf"} else "edit"
        return super().get_permissions()

    @action(detail=False, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request):
        queryset = self.filter_queryset(self.get_queryset()).order_by("name")
        pdf_buffer = render_departments_pdf(queryset)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename="departamentos-juhnios-rold.pdf",
            content_type="application/pdf",
        )


class PositionViewSet(SoftDeleteModelViewSet):
    queryset = Position.objects.select_related("department")
    serializer_class = PositionSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("department", "is_active")
    search_fields = ("name",)

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve", "export_pdf"} else "edit"
        return super().get_permissions()

    @action(detail=False, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request):
        queryset = self.filter_queryset(self.get_queryset()).order_by("department__name", "name")
        pdf_buffer = render_positions_pdf(queryset)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename="cargos-juhnios-rold.pdf",
            content_type="application/pdf",
        )


class BranchViewSet(SoftDeleteModelViewSet):
    queryset = Branch.objects.select_related("responsible").annotate(employee_count=Count("employees", distinct=True))
    serializer_class = BranchSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "employees.management"
    filterset_fields = ("is_active", "status", "city", "department", "country", "responsible")
    search_fields = ("code", "name", "address", "city", "department", "country", "email", "responsible__first_name", "responsible__last_name")
    ordering_fields = ("name", "code", "city", "department", "status", "created_at")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve", "export_pdf"} else "edit"
        return super().get_permissions()

    @action(detail=False, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request):
        queryset = self.filter_queryset(self.get_queryset()).order_by("name", "code")
        pdf_buffer = render_branches_pdf(queryset)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename="sedes-juhnios-rold.pdf",
            content_type="application/pdf",
        )


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
        if self.action == "me":
            return (IsAuthenticated(),)
        self.required_component_action = (
            "view" if self.action in {"list", "retrieve", "export_pdf", "export_profile_pdf"} else "edit"
        )
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=("get", "patch"), url_path="me")
    def me(self, request):
        try:
            employee = Employee.objects.select_related(
                "department", "position", "manager", "branch",
            ).prefetch_related("contracts", "working_days").get(user=request.user)
        except Employee.DoesNotExist:
            raise NotFound("Tu usuario no tiene un perfil de empleado asociado.")

        if request.method == "GET":
            serializer = EmployeeSelfServiceSerializer(employee, context={"request": request})
            return Response(serializer.data)

        serializer = EmployeeSelfServiceSerializer(
            employee, data=request.data, partial=True, context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request):
        queryset = self.filter_queryset(self.get_queryset()).order_by(
            "department__name",
            "position__name",
            "first_name",
            "last_name",
            "employee_code",
        )
        pdf_buffer = render_employees_pdf(queryset)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename="empleados-juhnios-rold.pdf",
            content_type="application/pdf",
        )

    @action(detail=True, methods=("get",), url_path="export-profile-pdf")
    def export_profile_pdf(self, request, pk=None):
        employee = self.get_object()
        pdf_buffer = render_employee_profile_pdf(employee)
        safe_code = (employee.employee_code or str(employee.id)).replace(" ", "-")
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f"perfil-{safe_code}.pdf",
            content_type="application/pdf",
        )


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
