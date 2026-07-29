import json
from decimal import Decimal, InvalidOperation

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
from apps.notifications.infrastructure.models import StaffNotification

from shared.domain.exceptions import BusinessRuleViolation

from ..application.use_cases import (
    CreateOvertimeRequestWithShifts,
    DefineRequestRemuneration,
    RegisterCheckIn,
    RegisterCheckOut,
    ResolveVacationRequestByRole,
)
from ..infrastructure.models import (
    Attendance,
    EmployeeDocument,
    Payroll,
    PerformanceReview,
    VacationRequest,
    VacationRequestApprovalStep,
    VacationRequestAttachment,
    VacationRequestHistory,
)
from ..infrastructure.request_excel import render_requests_xlsx
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

    OWNER_DELETABLE_STATUSES = (VacationRequest.Status.PENDING, VacationRequest.Status.IN_REVIEW)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        # Filtro por rango de fecha de la SOLICITUD (start_date/end_date, el
        # periodo del permiso/vacación/etc.), no la fecha en que se creó el
        # registro — para poder organizar el listado por cuándo es el permiso.
        start_from = self.request.query_params.get("start_date_from")
        start_to = self.request.query_params.get("start_date_to")
        if start_from:
            queryset = queryset.filter(start_date__gte=start_from)
        if start_to:
            queryset = queryset.filter(end_date__lte=start_to)
        return queryset

    def get_permissions(self):
        if self.action in {"me", "team", "loans", "approve", "reject", "destroy", "correct_schedule", "set_remuneration"}:
            return (IsAuthenticated(),)
        self.required_component_action = "view" if self.action in {"list", "retrieve", "dashboard"} else "edit"
        return super().get_permissions()

    def _self_service_queryset(self):
        return VacationRequest.objects.select_related(
            "employee",
            "employee__department",
            "employee__position",
            "employee__branch",
            "reviewed_by",
        )

    def destroy(self, request, *args, **kwargs):
        # El Administrador puede eliminar cualquier solicitud (borrado administrativo
        # general). Además, el propio empleado dueño de la solicitud puede eliminarla
        # (no editarla) mientras nadie la haya resuelto todavía — una vez que Jefe/
        # RRHH/Admin ya actuaron sobre ella, se conserva por trazabilidad.
        if getattr(request.user, "has_full_access", False):
            return super().destroy(request, *args, **kwargs)

        vacation = self.get_object()
        requester_employee = getattr(request.user, "employee_profile", None)
        is_owner = requester_employee is not None and vacation.employee_id == requester_employee.id
        if not is_owner:
            return Response(
                {"detail": "Solo un Administrador puede eliminar solicitudes de otros empleados."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if vacation.status not in self.OWNER_DELETABLE_STATUSES:
            return Response(
                {"detail": "Ya no puedes eliminar esta solicitud porque ya fue gestionada. Contacta a RRHH o al Administrador."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    def _ensure_approval_flow(self, vacation, requester=None):
        manager = getattr(vacation.employee, "manager", None)
        manager_user = getattr(manager, "user", None)

        # Si el jefe inmediato es también el Administrador, su firma como jefe y
        # como Admin serían la misma persona firmando dos veces por lo mismo: el
        # paso "Jefe inmediato" no aplica en ese caso (queda registrado como tal,
        # no como pendiente eterno) y el flujo real se reduce a RRHH + ese Admin.
        manager_is_admin = bool(manager_user and getattr(manager_user, "has_full_access", False))

        if manager_is_admin:
            manager_status = VacationRequest.Status.CANCELLED
            manager_comment = "No aplica: el jefe inmediato es el Administrador, su firma queda registrada en el paso de Aprobación final."
        else:
            manager_status = VacationRequest.Status.PENDING
            manager_comment = ""

        flow = (
            (VacationRequestApprovalStep.Step.REQUESTER, 1, requester or vacation.employee.user, VacationRequest.Status.APPROVED, "Solicitud creada"),
            (VacationRequestApprovalStep.Step.MANAGER, 2, manager_user, manager_status, manager_comment),
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
                    "acted_at": timezone.now() if step in (VacationRequestApprovalStep.Step.REQUESTER, VacationRequestApprovalStep.Step.MANAGER) and step_status != VacationRequest.Status.PENDING else None,
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

        queryset = self._self_service_queryset().filter(employee=employee).order_by("-created_at")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=("get",), permission_classes=(IsAuthenticated,), url_path="team")
    def team(self, request):
        """Solicitudes de los empleados que reportan directamente al usuario
        autenticado (su equipo a cargo como jefe inmediato).

        Las solicitudes de tipo PRÉSTAMO quedan excluidas de esta vista: son
        información sensible que el jefe inmediato no debe ver, solo Recursos
        Humanos, Contabilidad, el Administrador, o alguien con acceso puntual
        marcado explícitamente (ver ``VacationRequestViewSet.loans``)."""
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            return Response(
                {"detail": "Tu usuario no tiene un perfil de empleado asociado."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = self._self_service_queryset().filter(employee__manager=employee).order_by("-created_at")
        if not getattr(request.user, "can_view_loans", False):
            queryset = queryset.exclude(request_type=VacationRequest.RequestType.LOAN)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=("get",), permission_classes=(IsAuthenticated,), url_path="loans")
    def loans(self, request):
        """Listado dedicado y exclusivo de solicitudes de tipo PRÉSTAMO, para
        Recursos Humanos, Administrador, el rol Contabilidad, o cualquier
        usuario con acceso puntual (``can_view_loan_requests``). No expone
        ningún otro tipo de solicitud ni otros datos del módulo de RRHH."""
        if not getattr(request.user, "can_view_loans", False):
            return Response(
                {"detail": "No tienes permiso para ver solicitudes de préstamo."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = (
            self._self_service_queryset()
            .filter(request_type=VacationRequest.RequestType.LOAN)
            .order_by("-created_at")
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @staticmethod
    def _resolver_role(user, vacation=None):
        is_loan = vacation is not None and vacation.request_type == VacationRequest.RequestType.LOAN

        if is_loan:
            # Los préstamos tienen su propio circuito de aprobación, separado del
            # resto de solicitudes: solo Administrador o Tesorería deciden
            # (aprueban/rechazan). RRHH puede VER y descargar el PDF (ya cubierto
            # por HasComponentAccess en list/retrieve/export), pero no resolver —
            # y el jefe inmediato tampoco, salvo acceso puntual a préstamos.
            if getattr(user, "has_full_access", False):
                return "ADMIN"
            if "TESORERIA" in getattr(user, "all_role_codes", set()):
                return "HR"
            return None

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

        signature_override = request.FILES.get("signature_override")
        has_saved_signature = bool(getattr(getattr(request.user, "employee_profile", None), "signature", None))
        if not signature_override and not has_saved_signature:
            return Response(
                {
                    "detail": (
                        "No tienes una firma registrada. Dibuja o sube tu firma en este formulario, "
                        "o guárdala primero en tu perfil, para poder aprobar o rechazar."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        raw_is_remunerated = request.data.get("is_remunerated")
        is_remunerated = None
        if raw_is_remunerated is not None and raw_is_remunerated != "":
            is_remunerated = str(raw_is_remunerated).strip().lower() in ("true", "1", "yes")

        hr_slot_label = "Tesorería" if vacation.request_type == VacationRequest.RequestType.LOAN else "RRHH"

        raw_approved_amount = request.data.get("approved_amount")
        approved_amount = None
        if raw_approved_amount is not None and raw_approved_amount != "":
            try:
                approved_amount = Decimal(str(raw_approved_amount))
            except InvalidOperation:
                return Response({"detail": "El monto aprobado no es válido."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            vacation = ResolveVacationRequestByRole().execute(
                vacation,
                decision,
                request.user,
                role,
                request.data.get("comment", ""),
                request.FILES.get("signature_override"),
                is_remunerated,
                hr_slot_label,
                approved_amount,
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

    @action(detail=True, methods=("post",), url_path="set-remuneration")
    def set_remuneration(self, request, pk=None):
        """Define si la solicitud es remunerada o no, en cualquier momento
        (incluso ya aprobada) — decisión exclusiva del Administrador. Una vez
        guardada queda bloqueada de forma permanente."""
        if not getattr(request.user, "has_full_access", False):
            return Response(
                {"detail": "Solo el Administrador puede definir si una solicitud es remunerada."},
                status=status.HTTP_403_FORBIDDEN,
            )

        vacation = get_object_or_404(self.get_queryset(), pk=pk)

        raw_is_remunerated = request.data.get("is_remunerated")
        if raw_is_remunerated is None or raw_is_remunerated == "":
            return Response({"detail": "Indica si la solicitud es remunerada o no."}, status=status.HTTP_400_BAD_REQUEST)
        is_remunerated = str(raw_is_remunerated).strip().lower() in ("true", "1", "yes")

        try:
            vacation = DefineRequestRemuneration().execute(vacation, is_remunerated, request.user)
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(self.get_serializer(vacation).data)

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

    EDITABLE_SCHEDULE_STATUSES = (
        VacationRequest.Status.PENDING,
        VacationRequest.Status.IN_REVIEW,
        VacationRequest.Status.PENDING_HR,
        VacationRequest.Status.PENDING_ADMIN,
    )

    @action(detail=True, methods=("post",), url_path="correct-schedule")
    def correct_schedule(self, request, pk=None):
        """Corrección administrativa de fecha/hora: permite a Admin o RRHH arreglar
        un dato mal digitado por el empleado (ej. eligió el día equivocado), sin
        tener que rechazar y recrear todo el trámite. Solo mientras la solicitud
        siga sin resolver — una vez aprobada/rechazada/finalizada, la fecha/hora
        queda congelada como parte del registro histórico."""
        if not (getattr(request.user, "has_full_access", False) or getattr(request.user, "role_code", None) == "RRHH"):
            return Response(
                {"detail": "Solo Administrador o Recursos Humanos pueden corregir la fecha/hora de una solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )

        vacation = self.get_object()
        if vacation.status not in self.EDITABLE_SCHEDULE_STATUSES:
            return Response(
                {"detail": "Solo se puede corregir la fecha/hora mientras la solicitud sigue pendiente de resolución."},
                status=status.HTTP_409_CONFLICT,
            )

        EDITABLE_FIELDS = ("start_date", "end_date", "is_full_day", "start_time", "end_time")
        previous = {field: getattr(vacation, field) for field in EDITABLE_FIELDS}

        serializer = self.get_serializer(
            vacation,
            data={key: request.data[key] for key in EDITABLE_FIELDS if key in request.data},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        vacation = serializer.save()

        changes = []
        for field in EDITABLE_FIELDS:
            new_value = getattr(vacation, field)
            if previous[field] != new_value:
                changes.append(f"{field}: {previous[field] or '—'} → {new_value or '—'}")

        if changes:
            VacationRequestHistory.objects.create(
                request=vacation,
                action=VacationRequestHistory.Action.UPDATED,
                user=request.user,
                old_status=vacation.status,
                new_status=vacation.status,
                comment=f"Corrección de fecha/hora por {getattr(request.user, 'role_code', '')}: " + "; ".join(changes),
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

    @action(detail=False, methods=("get",), url_path="export-xlsx")
    def export_xlsx(self, request):
        """Excel descargable de solicitudes, con los mismos filtros del listado
        (request_type, status, employee__department, employee__branch, búsqueda)
        más un rango de fechas y orden por fecha de solicitud o por tipo."""
        queryset = self.filter_queryset(self.get_queryset()).prefetch_related("overtime_shifts")

        start_from = request.query_params.get("start_date_from")
        start_to = request.query_params.get("start_date_to")
        if start_from:
            queryset = queryset.filter(start_date__gte=start_from)
        if start_to:
            queryset = queryset.filter(end_date__lte=start_to)

        order_by = request.query_params.get("order_by")
        ordering_map = {
            "created_at": ("-created_at",),
            "request_type": ("request_type", "-created_at"),
            "start_date": ("-start_date",),
            "employee": ("employee__first_name", "employee__last_name", "-created_at"),
        }
        queryset = queryset.order_by(*ordering_map.get(order_by, ("-created_at",)))

        xlsx_buffer = render_requests_xlsx(queryset)
        return FileResponse(
            xlsx_buffer,
            as_attachment=True,
            filename=f"solicitudes-rrhh-{timezone.localdate():%Y%m%d}.xlsx",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
        StaffNotification.objects.update_or_create(
            document=document,
            notification_type=StaffNotification.NotificationType.DOCUMENT_EXPIRED,
            defaults={
                "module": "human_resources",
                "employee": document.employee,
                "title": "Documento vencido",
                "message": f"{document.get_document_type_display()} de {document.employee} está vencido.",
                "due_date": document.expires_at or timezone.localdate(),
                "status": StaffNotification.Status.UNREAD,
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
    queryset = StaffNotification.objects.filter(module="human_resources").select_related("employee", "document", "created_by")
    serializer_class = HRNotificationSerializer
    permission_classes = (HasComponentAccess,)
    required_component = "human_resources.management"
    filterset_fields = ("employee", "document", "notification_type", "status")
    search_fields = ("title", "message", "employee__employee_code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(module="human_resources")

    @action(detail=True, methods=("post",), url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.status = StaffNotification.Status.READ
        notification.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(notification).data)


class VacationRequestPdfView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, pk):
        queryset = VacationRequest.objects.select_related(
            "employee", "employee__department", "employee__position", "employee__branch",
            "admin_decided_by", "hr_decided_by",
        ).prefetch_related("approval_steps__user__employee_profile", "overtime_shifts")
        vacation = get_object_or_404(queryset, pk=pk)

        user = request.user
        is_loan = vacation.request_type == VacationRequest.RequestType.LOAN
        if is_loan and getattr(user, "can_view_loans", False):
            # Contabilidad, Tesorería (como rol principal o adicional), RRHH y
            # Admin siempre pueden ver/descargar el PDF de un préstamo — es
            # justamente para eso que existe `can_view_loans`.
            pass
        elif not (getattr(user, "has_full_access", False) or user.has_component_access("human_resources.management", "view")):
            # Sin acceso al módulo completo de RRHH: solo puede ver el PDF si es el
            # dueño de la solicitud o su jefe inmediato — y, si es de tipo PRÉSTAMO,
            # el jefe inmediato queda excluido salvo que tenga acceso especial a préstamos.
            requester_employee = getattr(user, "employee_profile", None)
            is_owner = requester_employee is not None and vacation.employee_id == requester_employee.id
            manager = getattr(vacation.employee, "manager", None)
            is_manager = requester_employee is not None and manager is not None and manager.id == requester_employee.id
            if is_manager and is_loan and not getattr(user, "can_view_loans", False):
                is_manager = False
            if not (is_owner or is_manager):
                return Response(
                    {"detail": "No tienes permiso para ver el documento de esta solicitud."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        pdf_buffer = render_request_pdf(vacation)
        return FileResponse(
            pdf_buffer,
            as_attachment=False,
            filename=f"{vacation.request_number or vacation.id}.pdf",
            content_type="application/pdf",
        )
