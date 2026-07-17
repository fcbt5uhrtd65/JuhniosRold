from django.core.files.base import ContentFile
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.identity.interfaces.permissions import HasComponentAccess
from shared.domain.exceptions import BusinessRuleViolation
from shared.interfaces.viewsets import SoftDeleteModelViewSet

from ..infrastructure.batch_pdf import (
    render_analysis_certificate_pdf,
    render_batch_release_pdf,
    render_dispensing_order_pdf,
    render_document_checklist_pdf,
    render_full_batch_dossier_pdf,
    render_line_clearance_pdf,
)

from ..application.use_cases import (
    ApproveLineClearance,
    ChangeBatchStatus,
    CloseDispensingOrder,
    ReleaseBatch,
    StartBatch,
    VerifyDispensingLine,
    WeighDispensingLine,
)
from ..infrastructure.models import (
    AnalysisCertificate,
    AnalysisTestResult,
    Batch,
    BatchExport,
    BatchLotMarking,
    BatchRelease,
    CleaningRecord,
    DispensingLine,
    DispensingOrder,
    DocumentAttachment,
    DocumentChecklistItem,
    FillingControl,
    FillingLogEntry,
    FillingParticipant,
    ItemStock,
    ItemStockMovement,
    LineClearance,
    LineClearanceCriterion,
    LineIdentification,
    ManufacturingStep,
    ManufacturingStepExecution,
    MicrobiologyAnalysis,
    PackagingControl,
    ProductionControl,
    ProductionControlMaterial,
    RawMaterialBatch,
    RawMaterialIdentificationPrint,
    SealIntegrityControl,
    SealIntegritySample,
    WeightVolumeControl,
    WeightVolumeSample,
)
from ..infrastructure.serializers import (
    AnalysisCertificateSerializer,
    AnalysisTestResultSerializer,
    BatchExportSerializer,
    BatchLotMarkingSerializer,
    BatchReleaseSerializer,
    BatchSerializer,
    CleaningRecordSerializer,
    DispensingLineSerializer,
    DispensingOrderSerializer,
    DocumentAttachmentSerializer,
    DocumentChecklistItemSerializer,
    FillingControlSerializer,
    FillingLogEntrySerializer,
    FillingParticipantSerializer,
    ItemStockMovementSerializer,
    ItemStockSerializer,
    LineClearanceCriterionSerializer,
    LineClearanceSerializer,
    LineIdentificationSerializer,
    ManufacturingStepExecutionSerializer,
    ManufacturingStepSerializer,
    MicrobiologyAnalysisSerializer,
    PackagingControlSerializer,
    ProductionControlMaterialSerializer,
    ProductionControlSerializer,
    RawMaterialBatchSerializer,
    RawMaterialIdentificationPrintSerializer,
    SealIntegrityControlSerializer,
    SealIntegritySampleSerializer,
    WeightVolumeControlSerializer,
    WeightVolumeSampleSerializer,
)


class ManufacturingBaseViewSet(SoftDeleteModelViewSet):
    """Todas las entidades del expediente de lote comparten el mismo
    componente de permisos y la misma regla view/edit."""

    permission_classes = (HasComponentAccess,)
    required_component = "manufacturing.management"

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve"} else "edit"
        return super().get_permissions()

    def _export_single_document(self, request, *, batch, document_code, render_fn, render_arg, filename_prefix):
        """Genera un documento individual, lo registra en BatchExport y lo
        devuelve como descarga — mismo patrón para todas las fases."""
        pdf_buffer = render_fn(render_arg)
        safe_code = (batch.production_order.batch_code or batch.production_order.number).replace(" ", "-")
        filename = f"{filename_prefix}-{safe_code}.pdf"

        export = BatchExport.objects.create(
            batch=batch,
            kind=BatchExport.Kind.SINGLE_DOCUMENT,
            document_code=document_code,
            generated_by=request.user,
        )
        export.file.save(filename, ContentFile(pdf_buffer.getvalue()), save=True)
        pdf_buffer.seek(0)
        return FileResponse(pdf_buffer, as_attachment=True, filename=filename, content_type="application/pdf")


class BatchViewSet(ManufacturingBaseViewSet):
    queryset = Batch.objects.select_related(
        "production_order",
        "production_order__formula",
        "production_order__output_item",
        "production_manager",
        "quality_manager",
    ).prefetch_related("status_history")
    serializer_class = BatchSerializer
    filterset_fields = ("status", "production_manager", "quality_manager")
    search_fields = ("production_order__number", "production_order__batch_code")

    def get_permissions(self):
        self.required_component_action = "view" if self.action in {"list", "retrieve", "pending"} else "edit"
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=("post",), url_path="change-status")
    def change_status(self, request, pk=None):
        batch = self.get_object()
        new_status = request.data.get("status")
        if not new_status:
            return Response({"detail": "Debes indicar el nuevo estado."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            batch = ChangeBatchStatus().execute(
                batch,
                new_status,
                request.user,
                reason=request.data.get("reason", ""),
                observation=request.data.get("observation", ""),
                evidence=request.FILES.get("evidence"),
            )
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(batch).data)

    @action(detail=True, methods=("post",), url_path="start")
    def start(self, request, pk=None):
        batch = self.get_object()
        try:
            batch = StartBatch().execute(batch, request.user)
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(batch).data)

    @action(detail=False, methods=("get",), url_path="pending")
    def pending(self, request):
        queryset = self.filter_queryset(self.get_queryset()).exclude(status__in=Batch.TERMINAL_STATUSES)
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=("post",), url_path="export-dossier")
    def export_dossier(self, request, pk=None):
        """Exportación completa del expediente del lote (todas las fases en
        un único PDF, en orden cronológico). Registra la exportación en
        BatchExport para no perder versiones anteriores una vez cerrado el lote."""
        batch = self.get_object()
        include_attachments = str(request.data.get("include_attachments", "true")).lower() != "false"
        include_photos = str(request.data.get("include_photos", "true")).lower() != "false"
        include_not_applicable = str(request.data.get("include_not_applicable", "false")).lower() == "true"

        pdf_buffer = render_full_batch_dossier_pdf(
            batch,
            include_attachments=include_attachments,
            include_photos=include_photos,
            include_not_applicable=include_not_applicable,
        )
        safe_code = (batch.production_order.batch_code or batch.production_order.number).replace(" ", "-")
        filename = f"expediente-{safe_code}.pdf"

        export = BatchExport.objects.create(
            batch=batch,
            kind=BatchExport.Kind.FULL_DOSSIER,
            include_attachments=include_attachments,
            include_photos=include_photos,
            include_not_applicable=include_not_applicable,
            generated_by=request.user,
        )
        export.file.save(filename, ContentFile(pdf_buffer.getvalue()), save=True)
        pdf_buffer.seek(0)
        return FileResponse(pdf_buffer, as_attachment=True, filename=filename, content_type="application/pdf")

    @action(detail=True, methods=("get",), url_path="exports")
    def exports(self, request, pk=None):
        batch = self.get_object()
        from ..infrastructure.serializers import BatchExportSerializer

        exports = batch.exports.all()
        return Response(BatchExportSerializer(exports, many=True).data)


# ── Inventario de materias primas ────────────────────────────────────────────

class RawMaterialBatchViewSet(ManufacturingBaseViewSet):
    queryset = RawMaterialBatch.objects.select_related("item", "supplier")
    serializer_class = RawMaterialBatchSerializer
    filterset_fields = ("item", "quality_status")
    search_fields = ("supplier_batch_code", "analysis_number")


class ItemStockViewSet(ManufacturingBaseViewSet):
    queryset = ItemStock.objects.select_related("item", "location", "raw_material_batch")
    serializer_class = ItemStockSerializer
    filterset_fields = ("item", "location")
    http_method_names = ("get", "head", "options")


class ItemStockMovementViewSet(ManufacturingBaseViewSet):
    queryset = ItemStockMovement.objects.select_related("item", "location", "raw_material_batch", "created_by")
    serializer_class = ItemStockMovementSerializer
    filterset_fields = ("item", "location", "movement_type")
    http_method_names = ("get", "post", "head", "options")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ── Dispensación ──────────────────────────────────────────────────────────────

class DispensingOrderViewSet(ManufacturingBaseViewSet):
    queryset = DispensingOrder.objects.select_related("batch", "responsible", "verifier").prefetch_related("lines")
    serializer_class = DispensingOrderSerializer
    filterset_fields = ("batch", "status")

    @action(detail=True, methods=("post",), url_path="close")
    def close(self, request, pk=None):
        order = self.get_object()
        location_id = request.data.get("location")
        if not location_id:
            return Response({"detail": "Debes indicar la bodega de origen."}, status=status.HTTP_400_BAD_REQUEST)
        from apps.inventory.infrastructure.models import Location

        try:
            location = Location.objects.get(pk=location_id)
            order = CloseDispensingOrder().execute(order, location=location, actor=request.user)
        except Location.DoesNotExist:
            return Response({"detail": "Bodega no encontrada."}, status=status.HTTP_400_BAD_REQUEST)
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=("get",), url_path="export")
    def export(self, request, pk=None):
        order = self.get_object()
        return self._export_single_document(
            request,
            batch=order.batch,
            document_code="DISPENSING_ORDER",
            render_fn=render_dispensing_order_pdf,
            render_arg=order,
            filename_prefix="orden-dispensacion",
        )


class DispensingLineViewSet(ManufacturingBaseViewSet):
    queryset = DispensingLine.objects.select_related("order", "item", "raw_material_batch", "weighed_by", "verified_by")
    serializer_class = DispensingLineSerializer
    filterset_fields = ("order", "item", "status")

    @action(detail=True, methods=("post",), url_path="weigh")
    def weigh(self, request, pk=None):
        line = self.get_object()
        try:
            line = WeighDispensingLine().execute(
                line,
                gross_weight=request.data.get("gross_weight"),
                tare=request.data.get("tare"),
                container=request.data.get("container", ""),
                actor=getattr(request.user, "employee_profile", None),
            )
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(line).data)

    @action(detail=True, methods=("post",), url_path="verify")
    def verify(self, request, pk=None):
        line = self.get_object()
        try:
            line = VerifyDispensingLine().execute(line, actor=getattr(request.user, "employee_profile", None))
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(line).data)


class RawMaterialIdentificationPrintViewSet(ManufacturingBaseViewSet):
    queryset = RawMaterialIdentificationPrint.objects.select_related("dispensing_line", "printed_by")
    serializer_class = RawMaterialIdentificationPrintSerializer
    filterset_fields = ("dispensing_line",)
    http_method_names = ("get", "post", "head", "options")

    def perform_create(self, serializer):
        serializer.save(printed_by=self.request.user)


# ── Instrucciones de fabricación ─────────────────────────────────────────────

class ManufacturingStepViewSet(ManufacturingBaseViewSet):
    queryset = ManufacturingStep.objects.select_related("formula", "formula_line")
    serializer_class = ManufacturingStepSerializer
    filterset_fields = ("formula",)


class ManufacturingStepExecutionViewSet(ManufacturingBaseViewSet):
    queryset = ManufacturingStepExecution.objects.select_related("batch", "step", "performed_by", "verified_by")
    serializer_class = ManufacturingStepExecutionSerializer
    filterset_fields = ("batch", "step", "status")


# ── Despeje de línea y limpieza ──────────────────────────────────────────────

class LineClearanceViewSet(ManufacturingBaseViewSet):
    queryset = LineClearance.objects.select_related("batch", "performed_by", "verified_by").prefetch_related("criteria")
    serializer_class = LineClearanceSerializer
    filterset_fields = ("batch", "phase", "status")

    @action(detail=True, methods=("post",), url_path="approve")
    def approve(self, request, pk=None):
        clearance = self.get_object()
        try:
            clearance = ApproveLineClearance().execute(clearance, actor=getattr(request.user, "employee_profile", None), approve=True)
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(clearance).data)

    @action(detail=True, methods=("post",), url_path="reject")
    def reject(self, request, pk=None):
        clearance = self.get_object()
        clearance = ApproveLineClearance().execute(clearance, actor=getattr(request.user, "employee_profile", None), approve=False)
        return Response(self.get_serializer(clearance).data)

    @action(detail=True, methods=("get",), url_path="export")
    def export(self, request, pk=None):
        clearance = self.get_object()
        return self._export_single_document(
            request,
            batch=clearance.batch,
            document_code="LINE_CLEARANCE",
            render_fn=render_line_clearance_pdf,
            render_arg=clearance,
            filename_prefix="despeje-linea",
        )


class LineClearanceCriterionViewSet(ManufacturingBaseViewSet):
    queryset = LineClearanceCriterion.objects.select_related("clearance", "corrective_action_by")
    serializer_class = LineClearanceCriterionSerializer
    filterset_fields = ("clearance", "criterion", "result")


class CleaningRecordViewSet(ManufacturingBaseViewSet):
    queryset = CleaningRecord.objects.select_related("batch", "performed_by", "verified_by")
    serializer_class = CleaningRecordSerializer
    filterset_fields = ("batch", "record_type", "result")


class LineIdentificationViewSet(ManufacturingBaseViewSet):
    queryset = LineIdentification.objects.select_related("batch", "placed_by", "removed_by")
    serializer_class = LineIdentificationSerializer
    filterset_fields = ("batch",)


# ── Control de producción ────────────────────────────────────────────────────

class ProductionControlViewSet(ManufacturingBaseViewSet):
    queryset = ProductionControl.objects.select_related("batch", "unit").prefetch_related("materials")
    serializer_class = ProductionControlSerializer
    filterset_fields = ("batch",)


class ProductionControlMaterialViewSet(ManufacturingBaseViewSet):
    queryset = ProductionControlMaterial.objects.select_related("control", "item", "delivered_by", "received_by")
    serializer_class = ProductionControlMaterialSerializer
    filterset_fields = ("control", "item")


# ── Control de llenado ───────────────────────────────────────────────────────

class FillingControlViewSet(ManufacturingBaseViewSet):
    queryset = FillingControl.objects.select_related("batch", "responsible", "verifier").prefetch_related(
        "participants", "log_entries"
    )
    serializer_class = FillingControlSerializer
    filterset_fields = ("batch",)


class FillingParticipantViewSet(ManufacturingBaseViewSet):
    queryset = FillingParticipant.objects.select_related("control", "employee")
    serializer_class = FillingParticipantSerializer
    filterset_fields = ("control", "employee")


class FillingLogEntryViewSet(ManufacturingBaseViewSet):
    queryset = FillingLogEntry.objects.select_related("control", "performed_by", "verified_by")
    serializer_class = FillingLogEntrySerializer
    filterset_fields = ("control",)


# ── Peso o volumen ────────────────────────────────────────────────────────────

class WeightVolumeControlViewSet(ManufacturingBaseViewSet):
    queryset = WeightVolumeControl.objects.select_related("batch", "unit", "performed_by", "verified_by").prefetch_related("samples")
    serializer_class = WeightVolumeControlSerializer
    filterset_fields = ("batch", "overall_result")


class WeightVolumeSampleViewSet(ManufacturingBaseViewSet):
    queryset = WeightVolumeSample.objects.select_related("control", "adjustment_by")
    serializer_class = WeightVolumeSampleSerializer
    filterset_fields = ("control", "result")


# ── Hermeticidad ──────────────────────────────────────────────────────────────

class SealIntegrityControlViewSet(ManufacturingBaseViewSet):
    queryset = SealIntegrityControl.objects.select_related("batch", "performed_by", "verified_by").prefetch_related("samples")
    serializer_class = SealIntegrityControlSerializer
    filterset_fields = ("batch", "overall_result")


class SealIntegritySampleViewSet(ManufacturingBaseViewSet):
    queryset = SealIntegritySample.objects.select_related("control")
    serializer_class = SealIntegritySampleSerializer
    filterset_fields = ("control", "result")


# ── Acondicionamiento ─────────────────────────────────────────────────────────

class PackagingControlViewSet(ManufacturingBaseViewSet):
    queryset = PackagingControl.objects.select_related("batch", "responsible", "verifier").prefetch_related("lot_markings")
    serializer_class = PackagingControlSerializer
    filterset_fields = ("batch",)


class BatchLotMarkingViewSet(ManufacturingBaseViewSet):
    queryset = BatchLotMarking.objects.select_related("packaging_control", "performed_by", "verified_by")
    serializer_class = BatchLotMarkingSerializer
    filterset_fields = ("packaging_control", "stage")


# ── Certificado de análisis y microbiología ──────────────────────────────────

class AnalysisCertificateViewSet(ManufacturingBaseViewSet):
    queryset = AnalysisCertificate.objects.select_related("batch", "analyzed_by", "verified_by").prefetch_related("tests")
    serializer_class = AnalysisCertificateSerializer
    filterset_fields = ("batch", "concept")

    @action(detail=True, methods=("get",), url_path="export")
    def export(self, request, pk=None):
        certificate = self.get_object()
        return self._export_single_document(
            request,
            batch=certificate.batch,
            document_code="ANALYSIS_CERTIFICATE",
            render_fn=render_analysis_certificate_pdf,
            render_arg=certificate,
            filename_prefix="certificado-analisis",
        )


class AnalysisTestResultViewSet(ManufacturingBaseViewSet):
    queryset = AnalysisTestResult.objects.select_related("certificate", "performed_by", "verified_by")
    serializer_class = AnalysisTestResultSerializer
    filterset_fields = ("certificate",)


class MicrobiologyAnalysisViewSet(ManufacturingBaseViewSet):
    queryset = MicrobiologyAnalysis.objects.select_related("batch", "taken_by", "approved_by")
    serializer_class = MicrobiologyAnalysisSerializer
    filterset_fields = ("batch", "overall_result")


# ── Verificación documental ───────────────────────────────────────────────────

class DocumentChecklistItemViewSet(ManufacturingBaseViewSet):
    queryset = DocumentChecklistItem.objects.select_related("batch", "responsible", "verifier")
    serializer_class = DocumentChecklistItemSerializer
    filterset_fields = ("batch", "document_code", "status", "applies")

    @action(detail=False, methods=("get",), url_path="summary")
    def summary(self, request):
        batch_id = request.query_params.get("batch")
        if not batch_id:
            return Response({"detail": "Debes indicar el lote."}, status=status.HTTP_400_BAD_REQUEST)
        queryset = self.get_queryset().filter(batch_id=batch_id)
        total = queryset.count()
        completed = queryset.filter(status=DocumentChecklistItem.Status.APPROVED).count()
        pending = queryset.filter(status__in=(DocumentChecklistItem.Status.PENDING, DocumentChecklistItem.Status.IN_PROGRESS)).count()
        rejected = queryset.filter(status=DocumentChecklistItem.Status.REJECTED).count()
        not_applicable = queryset.filter(applies=False).count()
        return Response(
            {
                "total": total,
                "completed": completed,
                "pending": pending,
                "rejected": rejected,
                "not_applicable": not_applicable,
                "completion_percentage": round((completed / total) * 100) if total else 0,
            }
        )

    @action(detail=False, methods=("get",), url_path="export")
    def export(self, request):
        batch_id = request.query_params.get("batch")
        if not batch_id:
            return Response({"detail": "Debes indicar el lote."}, status=status.HTTP_400_BAD_REQUEST)
        batch = Batch.objects.filter(pk=batch_id).first()
        if not batch:
            return Response({"detail": "Lote no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return self._export_single_document(
            request,
            batch=batch,
            document_code="DOCUMENT_CHECKLIST",
            render_fn=render_document_checklist_pdf,
            render_arg=batch,
            filename_prefix="verificacion-documental",
        )


class DocumentAttachmentViewSet(ManufacturingBaseViewSet):
    queryset = DocumentAttachment.objects.select_related("batch", "uploaded_by")
    serializer_class = DocumentAttachmentSerializer
    filterset_fields = ("batch", "document_code")

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


# ── Liberación ────────────────────────────────────────────────────────────────

class BatchReleaseViewSet(ManufacturingBaseViewSet):
    queryset = BatchRelease.objects.select_related("batch", "unit", "warehouse_location", "released_by_quality", "approved_by_technical_director")
    serializer_class = BatchReleaseSerializer
    filterset_fields = ("batch", "condition")

    @action(detail=False, methods=("post",), url_path="release")
    def release(self, request):
        batch_id = request.data.get("batch")
        if not batch_id:
            return Response({"detail": "Debes indicar el lote."}, status=status.HTTP_400_BAD_REQUEST)
        batch = Batch.objects.filter(pk=batch_id).first()
        if not batch:
            return Response({"detail": "Lote no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        try:
            release = ReleaseBatch().execute(
                batch,
                actor=getattr(request.user, "employee_profile", None),
                released_quantity=request.data.get("released_quantity", 0),
                retained_quantity=request.data.get("retained_quantity", 0),
                rejected_quantity=request.data.get("rejected_quantity", 0),
                unit=request.data.get("unit"),
                warehouse_location=request.data.get("warehouse_location"),
                condition=request.data.get("condition", BatchRelease.Condition.CONDITIONAL),
                observations=request.data.get("observations", ""),
            )
        except BusinessRuleViolation as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(release).data)

    @action(detail=True, methods=("get",), url_path="export")
    def export(self, request, pk=None):
        release = self.get_object()
        return self._export_single_document(
            request,
            batch=release.batch,
            document_code="RELEASE",
            render_fn=render_batch_release_pdf,
            render_arg=release,
            filename_prefix="liberacion",
        )


class BatchExportViewSet(ManufacturingBaseViewSet):
    queryset = BatchExport.objects.select_related("batch", "generated_by")
    serializer_class = BatchExportSerializer
    filterset_fields = ("batch", "kind")
    http_method_names = ("get", "post", "head", "options")
