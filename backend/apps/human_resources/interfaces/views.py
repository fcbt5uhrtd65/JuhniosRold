from collections import defaultdict

from django.db.models import Sum
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from shared.interfaces.viewsets import SoftDeleteModelViewSet

from apps.employees.infrastructure.models import Employee
from apps.identity.interfaces.permissions import HasComponentAccess

from shared.domain.exceptions import BusinessRuleViolation

from ..application.use_cases import RegisterCheckIn, RegisterCheckOut, ResolveVacationRequestByRole
from ..infrastructure.models import (
    Attendance,
    EmployeeDocument,
    HRNotification,
    Payroll,
    PerformanceReview,
    VacationRequest,
    VacationRequestApprovalStep,
    VacationRequestAttachment,
    VacationRequestHistory,
)
from ..infrastructure.request_pdf import render_request_pdf
from ..infrastructure.serializers import (
    AttendanceSerializer,
    EmployeeDocumentSerializer,
    EmployeeSelfServiceDocumentSerializer,
    HRNotificationSerializer,
    PayrollSerializer,
    PerformanceReviewSerializer,
    VacationRequestAttachmentSerializer,
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
    queryset = (
        VacationRequest.objects.select_related(
            "employee",
            "employee__department",
            "employee__position",
            "employee__branch",
            "reviewed_by",
        )
        .prefetch_related("attachments", "approval_steps", "history")
    )
    serializer_class = VacationRequestSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "status", "request_type", "subtype", "employee__department", "employee__branch")
    search_fields = ("request_number", "reason", "description", "employee__employee_code", "employee__first_name", "employee__last_name")
    ordering_fields = ("created_at", "start_date", "end_date", "status", "request_type")

    def get_permissions(self):
        if self.action == "me":
            return (IsAuthenticated(),)
        self.required_component_action = "view" if self.action in {"list", "retrieve", "dashboard"} else "edit"
        return super().get_permissions()

    def _ensure_approval_flow(self, vacation, requester=None):
        manager_user = getattr(getattr(vacation.employee, "manager", None), "user", None)
        flow = (
            (VacationRequestApprovalStep.Step.REQUESTER, 1, requester or vacation.employee.user, VacationRequest.Status.APPROVED, "Solicitud creada"),
            (VacationRequestApprovalStep.Step.MANAGER, 2, manager_user, VacationRequest.Status.PENDING, ""),
            (VacationRequestApprovalStep.Step.HR, 3, None, VacationRequest.Status.PENDING, ""),
            (VacationRequestApprovalStep.Step.FINAL, 4, None, VacationRequest.Status.PENDING, ""),
        )
        for step, sequence, user, step_status, comment in flow:
            VacationRequestApprovalStep.objects.get_or_create(
                request=vacation,
                step=step,
                defaults={
                    "sequence": sequence,
                    "user": user,
                    "status": step_status,
                    "acted_at": timezone.now() if step == VacationRequestApprovalStep.Step.REQUESTER else None,
                    "comment": comment,
                },
            )

    def perform_create(self, serializer):
        employee_id = self.request.data.get("employee") or self.request.data.get("employee_id")
        employee = Employee.objects.get(id=employee_id) if employee_id else getattr(self.request.user, "employee_profile", None)
        vacation = serializer.save(employee=employee)
        self._ensure_approval_flow(vacation, self.request.user)
        VacationRequestHistory.objects.create(
            request=vacation,
            action=VacationRequestHistory.Action.CREATED,
            user=self.request.user,
            new_status=vacation.status,
            comment="Solicitud creada",
        )

    @action(detail=False, methods=("get", "post"), permission_classes=(IsAuthenticated,), url_path="me")
    def me(self, request):
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            return Response(
                {"detail": "Tu usuario no tiene un perfil de empleado asociado."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.method == "POST":
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            vacation = serializer.save(employee=employee)
            self._ensure_approval_flow(vacation, request.user)
            VacationRequestHistory.objects.create(
                request=vacation,
                action=VacationRequestHistory.Action.CREATED,
                user=request.user,
                new_status=vacation.status,
                comment="Solicitud creada por empleado",
            )
            return Response(self.get_serializer(vacation).data, status=status.HTTP_201_CREATED)

        queryset = self.get_queryset().filter(employee=employee).order_by("-created_at")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @staticmethod
    def _resolver_role(user):
        if getattr(user, "has_full_access", False):
            return "ADMIN"
        if getattr(user, "role_code", None) == "RRHH":
            return "HR"
        return None

    def _resolve(self, request, decision):
        role = self._resolver_role(request.user)
        if role is None:
            return Response(
                {"detail": "Solo Administrador o Recursos Humanos pueden resolver solicitudes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            vacation = ResolveVacationRequestByRole().execute(
                self.get_object(),
                decision,
                request.user,
                role,
                request.data.get("comment", ""),
            )
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(vacation).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return self._resolve(request, VacationRequest.Status.APPROVED)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return self._resolve(request, VacationRequest.Status.REJECTED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        vacation = self.get_object()
        if vacation.status in ResolveVacationRequestByRole.TERMINAL_STATUSES:
            return Response({"detail": "La solicitud ya fue resuelta."}, status=status.HTTP_400_BAD_REQUEST)
        old_status = vacation.status
        vacation.status = VacationRequest.Status.CANCELLED
        vacation.save(update_fields=("status", "updated_at"))
        VacationRequestHistory.objects.create(
            request=vacation,
            action=VacationRequestHistory.Action.UPDATED,
            user=request.user,
            old_status=old_status,
            new_status=vacation.status,
            comment=request.data.get("comment", "Solicitud cancelada"),
        )
        return Response(self.get_serializer(vacation).data)

    @action(detail=True, methods=("post",))
    def finalize(self, request, pk=None):
        role = self._resolver_role(request.user)
        if role != "ADMIN":
            return Response(
                {"detail": "Solo el Administrador puede finalizar una solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )
        vacation = self.get_object()
        if vacation.status != VacationRequest.Status.APPROVED:
            return Response(
                {"detail": "Solo una solicitud aprobada puede finalizarse."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_status = vacation.status
        vacation.status = VacationRequest.Status.FINALIZED
        vacation.save(update_fields=("status", "updated_at"))
        VacationRequestHistory.objects.create(
            request=vacation,
            action=VacationRequestHistory.Action.UPDATED,
            user=request.user,
            old_status=old_status,
            new_status=vacation.status,
            comment=request.data.get("comment", "Solicitud finalizada"),
        )
        return Response(self.get_serializer(vacation).data)

    @action(detail=False, methods=("get",), url_path="dashboard")
    def dashboard(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        today = timezone.localdate()
        expired = queryset.filter(due_date__lt=today).exclude(
            status__in=(VacationRequest.Status.APPROVED, VacationRequest.Status.REJECTED)
        )
        by_month = defaultdict(int)
        by_type = defaultdict(int)
        by_area = defaultdict(int)
        by_branch = defaultdict(int)
        for item in queryset:
            by_month[item.created_at.strftime("%Y-%m")] += 1
            by_type[item.request_type] += 1
            by_area[item.employee.department.name if item.employee.department_id else "Sin área"] += 1
            by_branch[item.employee.branch.name if item.employee.branch_id else "Sin sede"] += 1

        return Response(
            {
                "pending": queryset.filter(status=VacationRequest.Status.PENDING).count(),
                "approved": queryset.filter(status=VacationRequest.Status.APPROVED).count(),
                "rejected": queryset.filter(status=VacationRequest.Status.REJECTED).count(),
                "in_review": queryset.filter(status=VacationRequest.Status.IN_REVIEW).count(),
                "expired": expired.count(),
                "overtime_hours": queryset.filter(request_type=VacationRequest.RequestType.OVERTIME).aggregate(total=Sum("hours_count"))["total"] or 0,
                "incapacity_days": queryset.filter(request_type=VacationRequest.RequestType.INCAPACITY).aggregate(total=Sum("days_count"))["total"] or 0,
                "pending_vacation_days": queryset.filter(
                    request_type=VacationRequest.RequestType.VACATION,
                    status__in=(VacationRequest.Status.PENDING, VacationRequest.Status.IN_REVIEW),
                ).aggregate(total=Sum("days_count"))["total"] or 0,
                "charts": {
                    "by_month": [{"label": key, "value": value} for key, value in sorted(by_month.items())],
                    "by_type": [{"label": key, "value": value} for key, value in sorted(by_type.items())],
                    "by_area": [{"label": key, "value": value} for key, value in sorted(by_area.items())],
                    "by_branch": [{"label": key, "value": value} for key, value in sorted(by_branch.items())],
                },
            }
        )


class VacationRequestAttachmentViewSet(SoftDeleteModelViewSet):
    queryset = VacationRequestAttachment.objects.select_related("request", "uploaded_by")
    serializer_class = VacationRequestAttachmentSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("request", "attachment_type", "uploaded_by")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    def perform_create(self, serializer):
        attachment = serializer.save(uploaded_by=self.request.user)
        VacationRequestHistory.objects.create(
            request=attachment.request,
            action=VacationRequestHistory.Action.UPDATED,
            user=self.request.user,
            comment=f"Adjunto agregado: {attachment.name}",
        )


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
    queryset = EmployeeDocument.objects.select_related("employee", "uploaded_by")
    serializer_class = EmployeeDocumentSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "document_type", "status", "uploaded_by")

    def get_permissions(self):
        if self.action == "me":
            return (IsAuthenticated(),)
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    @action(detail=False, methods=("get", "post"), url_path="me")
    def me(self, request):
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            raise NotFound("Tu usuario no tiene un perfil de empleado asociado.")

        if request.method == "GET":
            documents = self.get_queryset().filter(employee=employee)
            serializer = EmployeeSelfServiceDocumentSerializer(documents, many=True, context={"request": request})
            return Response(serializer.data)

        serializer = EmployeeSelfServiceDocumentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        document = serializer.save(employee=employee, uploaded_by=request.user, status=EmployeeDocument.Status.LOADED)
        self._create_document_alert(document)
        return Response(EmployeeSelfServiceDocumentSerializer(document).data, status=status.HTTP_201_CREATED)

    def _create_document_alert(self, document):
        if document.status != EmployeeDocument.Status.EXPIRED:
            return
        HRNotification.objects.update_or_create(
            document=document,
            notification_type=HRNotification.NotificationType.DOCUMENT_EXPIRED,
            defaults={
                "employee": document.employee,
                "title": "Documento vencido",
                "message": f"{document.get_document_type_display()} de {document.employee} está vencido.",
                "due_date": document.expires_at or timezone.localdate(),
                "status": HRNotification.Status.UNREAD,
                "created_by": self.request.user,
            },
        )

    def perform_create(self, serializer):
        document = serializer.save(uploaded_by=self.request.user)
        self._create_document_alert(document)

    def perform_update(self, serializer):
        document = serializer.save()
        self._create_document_alert(document)


class HRNotificationViewSet(SoftDeleteModelViewSet):
    queryset = HRNotification.objects.select_related("employee", "document", "created_by")
    serializer_class = HRNotificationSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "document", "notification_type", "status")
    search_fields = ("title", "message", "employee__employee_code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.status = HRNotification.Status.READ
        notification.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(notification).data)


class VacationRequestPdfView(APIView):
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    required_component_action = "view"

    def get(self, request, pk):
        queryset = VacationRequest.objects.select_related(
            "employee", "employee__department", "employee__position", "employee__branch",
            "admin_decided_by", "hr_decided_by",
        ).prefetch_related("approval_steps")
        vacation = get_object_or_404(queryset, pk=pk)
        pdf_buffer = render_request_pdf(vacation)
        return FileResponse(
            pdf_buffer,
            as_attachment=False,
            filename=f"{vacation.request_number or vacation.id}.pdf",
            content_type="application/pdf",
        )
