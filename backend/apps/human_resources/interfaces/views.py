from rest_framework.decorators import action
from rest_framework.response import Response

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from apps.employees.infrastructure.models import Employee
from apps.identity.interfaces.permissions import HasComponentAccess

from ..application.use_cases import RegisterCheckIn, RegisterCheckOut, ResolveVacationRequest
from ..infrastructure.models import Attendance, EmployeeDocument, Payroll, PerformanceReview, VacationRequest
from ..infrastructure.serializers import (
    AttendanceSerializer,
    EmployeeDocumentSerializer,
    PayrollSerializer,
    PerformanceReviewSerializer,
    VacationRequestSerializer,
)


class AttendanceViewSet(SoftDeleteModelViewSet):
    queryset = Attendance.objects.select_related("employee")
    serializer_class = AttendanceSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "date")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    @action(detail=False, methods=("post",), url_path="check-in")
    def check_in(self, request):
        employee = Employee.objects.get(id=request.data["employee_id"])
        return Response(self.get_serializer(RegisterCheckIn().execute(employee)).data)

    @action(detail=False, methods=("post",), url_path="check-out")
    def check_out(self, request):
        employee = Employee.objects.get(id=request.data["employee_id"])
        return Response(self.get_serializer(RegisterCheckOut().execute(employee)).data)


class VacationRequestViewSet(SoftDeleteModelViewSet):
    queryset = VacationRequest.objects.select_related("employee", "reviewed_by")
    serializer_class = VacationRequestSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "status")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        vacation = ResolveVacationRequest().execute(
            self.get_object(), VacationRequest.Status.APPROVED, request.user
        )
        return Response(self.get_serializer(vacation).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        vacation = ResolveVacationRequest().execute(
            self.get_object(), VacationRequest.Status.REJECTED, request.user
        )
        return Response(self.get_serializer(vacation).data)


class PayrollViewSet(SoftDeleteModelViewSet):
    queryset = Payroll.objects.select_related("employee").prefetch_related("items")
    serializer_class = PayrollSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "status")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class PerformanceReviewViewSet(SoftDeleteModelViewSet):
    queryset = PerformanceReview.objects.select_related("employee", "reviewer")
    serializer_class = PerformanceReviewSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "reviewer")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()


class EmployeeDocumentViewSet(SoftDeleteModelViewSet):
    queryset = EmployeeDocument.objects.select_related("employee")
    serializer_class = EmployeeDocumentSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "document_type")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()
