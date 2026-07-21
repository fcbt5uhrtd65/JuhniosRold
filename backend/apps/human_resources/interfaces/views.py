import json

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
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

from ..application.use_cases import (
    CreateOvertimeRequestWithShifts,
    RegisterCheckIn,
    RegisterCheckOut,
    ResolveVacationRequestByRole,
)
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
from ..infrastructure.request_list_pdf import render_request_list_pdf
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
        if self.action in {"me", "team", "approve", "reject"}:
            return (IsAuthenticated(),)
        self.required_component_action = "view" if self.action in {"list", "retrieve", "dashboard"} else "edit"
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        # Borrar solicitudes queda reservado al Administrador: RRHH puede gestionar
        # (crear/aprobar/rechazar) pero no eliminar del historial, para no perder
        # trazabilidad por error operativo del día a día.
        if not getattr(request.user, "has_full_access", False):
            return Response(
                {"detail": "Solo un Administrador puede eliminar solicitudes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

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
            raw_shifts = request.data.get("overtime_shifts")
            if raw_shifts:
                if isinstance(raw_shifts, str):
                    try:
                        raw_shifts = json.loads(raw_shifts)
                    except ValueError:
                        return Response({"detail": "overtime_shifts debe ser una lista JSON válida."}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    vacation = CreateOvertimeRequestWithShifts().execute(
                        employee,
                        raw_shifts,
                        reason=request.data.get("reason", ""),
                        description=request.data.get("description", ""),
                        observations=request.data.get("observations", ""),
                        support_document=request.FILES.get("support_document"),
                    )
                except BusinessRuleViolation as exc:
                    return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                self._ensure_approval_flow(vacation, request.user)
                VacationRequestHistory.objects.create(
                    request=vacation,
                    action=VacationRequestHistory.Action.CREATED,
                    user=request.user,
                    new_status=vacation.status,
                    comment="Solicitud de horas extra creada por empleado (múltiples turnos)",
                )
                return Response(self.get_serializer(vacation).data, status=status.HTTP_201_CREATED)

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

    @action(detail=False, methods=("get",), permission_classes=(IsAuthenticated,), url_path="team")
    def team(self, request):
        """Solicitudes de los empleados que reportan directamente al usuario
        autenticado (su equipo a cargo como jefe inmediato)."""
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            return Response(
                {"detail": "Tu usuario no tiene un perfil de empleado asociado."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = self.get_queryset().filter(employee__manager=employee).order_by("-created_at")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @staticmethod
    def _resolver_role(user, vacation=None):
        if getattr(user, "has_full_access", False):
            return "ADMIN"
        if getattr(user, "role_code", None) == "RRHH":
            return "HR"
        if vacation is not None:
            requester_employee = vacation.employee
            manager = getattr(requester_employee, "manager", None)
            if manager is not None and getattr(manager, "user_id", None) == user.id:
                return "MANAGER"
        return None

    def _resolve(self, request, decision):
        # get_permissions ya deja pasar cualquier usuario autenticado en approve/reject
        # (para permitir al jefe inmediato); la autorización real se valida aquí, por
        # objeto, ya que depende de la solicitud puntual (¿es su subordinado directo?).
        vacation = get_object_or_404(self.get_queryset(), pk=self.kwargs.get("pk"))
        role = self._resolver_role(request.user, vacation)
        if role is None:
            return Response(
                {"detail": "No tienes permiso para resolver esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            vacation = ResolveVacationRequestByRole().execute(
                vacation,
                decision,
                request.user,
                role,
                request.data.get("comment", ""),
                request.FILES.get("signature_override"),
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

        # Agregación hecha en SQL (values().annotate(Count(...))) en vez de iterar el
        # queryset completo en Python — escala con el volumen de solicitudes históricas.
        by_month_qs = (
            queryset.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(value=Count("id"))
            .order_by("month")
        )
        by_type_qs = queryset.values("request_type").annotate(value=Count("id")).order_by("request_type")
        by_area_qs = (
            queryset.values("employee__department__name")
            .annotate(value=Count("id"))
            .order_by("-value")
        )
        by_branch_qs = (
            queryset.values("employee__branch__name")
            .annotate(value=Count("id"))
            .order_by("-value")
        )
        by_employee_qs = (
            queryset.values(
                "employee__id",
                "employee__first_name",
                "employee__last_name",
                "employee__employee_code",
            )
            .annotate(value=Count("id"))
            .order_by("-value")[:20]
        )

        request_type_labels = dict(VacationRequest.RequestType.choices)

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
                    "by_month": [
                        {"label": row["month"].strftime("%Y-%m"), "value": row["value"]}
                        for row in by_month_qs if row["month"]
                    ],
                    "by_type": [
                        {"label": request_type_labels.get(row["request_type"], row["request_type"]), "value": row["value"]}
                        for row in by_type_qs
                    ],
                    "by_area": [
                        {"label": row["employee__department__name"] or "Sin área", "value": row["value"]}
                        for row in by_area_qs
                    ],
                    "by_branch": [
                        {"label": row["employee__branch__name"] or "Sin sede", "value": row["value"]}
                        for row in by_branch_qs
                    ],
                    "by_employee": [
                        {
                            "employee_id": str(row["employee__id"]),
                            "label": (
                                f"{row['employee__first_name']} {row['employee__last_name']}".strip()
                                or row["employee__employee_code"]
                            ),
                            "value": row["value"],
                        }
                        for row in by_employee_qs
                    ],
                },
            }
        )

    @action(detail=False, methods=("get",), url_path="export-list-pdf")
    def export_list_pdf(self, request):
        """Listado descargable de solicitudes (vacaciones, permisos, horas extras,
        licencias, incapacidades) con resumen por tipo y trazabilidad de quién
        resolvió cada una. Admite los mismos filtros que el listado (request_type,
        status, employee__department, employee__branch) más un rango de fechas."""
        queryset = self.filter_queryset(self.get_queryset())

        start_from = request.query_params.get("start_date_from")
        start_to = request.query_params.get("start_date_to")
        if start_from:
            queryset = queryset.filter(start_date__gte=start_from)
        if start_to:
            queryset = queryset.filter(end_date__lte=start_to)

        queryset = queryset.order_by("employee__first_name", "employee__last_name", "-start_date")

        filters_applied = []
        request_type = request.query_params.get("request_type")
        if request_type:
            filters_applied.append(("Tipo", dict(VacationRequest.RequestType.choices).get(request_type, request_type)))
        status_param = request.query_params.get("status")
        if status_param:
            filters_applied.append(("Estado", dict(VacationRequest.Status.choices).get(status_param, status_param)))
        if start_from:
            filters_applied.append(("Desde", start_from))
        if start_to:
            filters_applied.append(("Hasta", start_to))
        department = request.query_params.get("employee__department")
        if department:
            filters_applied.append(("Área", department))
        branch = request.query_params.get("employee__branch")
        if branch:
            filters_applied.append(("Sede", branch))

        pdf_buffer = render_request_list_pdf(queryset, filters_applied=filters_applied)
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f"solicitudes-rrhh-{timezone.localdate():%Y%m%d}.pdf",
            content_type="application/pdf",
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
        ).prefetch_related("approval_steps__user__employee_profile")
        vacation = get_object_or_404(queryset, pk=pk)
        pdf_buffer = render_request_pdf(vacation)
        return FileResponse(
            pdf_buffer,
            as_attachment=False,
            filename=f"{vacation.request_number or vacation.id}.pdf",
            content_type="application/pdf",
        )
