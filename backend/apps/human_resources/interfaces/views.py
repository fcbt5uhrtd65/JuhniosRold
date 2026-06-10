from rest_framework.decorators import action
from rest_framework.response import Response

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from apps.employees.infrastructure.models import Employee

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
    filterset_fields = ("employee", "date")

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
    filterset_fields = ("employee", "status")

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
    filterset_fields = ("employee", "status")


class PerformanceReviewViewSet(SoftDeleteModelViewSet):
    queryset = PerformanceReview.objects.select_related("employee", "reviewer")
    serializer_class = PerformanceReviewSerializer
    filterset_fields = ("employee", "reviewer")


class EmployeeDocumentViewSet(SoftDeleteModelViewSet):
    queryset = EmployeeDocument.objects.select_related("employee")
    serializer_class = EmployeeDocumentSerializer
    filterset_fields = ("employee", "document_type")
