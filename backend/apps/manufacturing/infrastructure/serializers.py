from rest_framework import serializers

from .models import (
    AnalysisCertificate,
    AnalysisTestResult,
    Batch,
    BatchExport,
    BatchLotMarking,
    BatchRelease,
    BatchStatusHistory,
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
    ProductSpecification,
    ProductSpecificationTest,
    RawMaterialBatch,
    RawMaterialIdentificationPrint,
    SealIntegrityControl,
    SealIntegritySample,
    WeightVolumeControl,
    WeightVolumeSample,
)


# ── Lote / expediente ────────────────────────────────────────────────────────

class BatchStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchStatusHistory
        fields = "__all__"
        read_only_fields = ("changed_by",)


class BatchSerializer(serializers.ModelSerializer):
    status_history = BatchStatusHistorySerializer(many=True, read_only=True)
    production_order_number = serializers.CharField(source="production_order.number", read_only=True)
    batch_code = serializers.CharField(source="production_order.batch_code", read_only=True)
    is_terminal = serializers.BooleanField(read_only=True)

    class Meta:
        model = Batch
        fields = (
            "id",
            "production_order",
            "production_order_number",
            "batch_code",
            "status",
            "area",
            "production_line",
            "production_manager",
            "quality_manager",
            "scheduled_at",
            "actual_start_at",
            "actual_end_at",
            "notes",
            "created_by",
            "is_terminal",
            "status_history",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_by",)

    def validate_production_order(self, value):
        if Batch.objects.filter(production_order=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError(
                "Esta orden de producción ya tiene un lote creado. Selecciona otra orden o abre el lote existente."
            )
        return value


# ── Inventario de materias primas ────────────────────────────────────────────

class RawMaterialBatchSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)
    is_usable = serializers.BooleanField(read_only=True)

    class Meta:
        model = RawMaterialBatch
        fields = "__all__"


class ItemStockSerializer(serializers.ModelSerializer):
    available_quantity = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)

    class Meta:
        model = ItemStock
        fields = "__all__"
        read_only_fields = ("quantity",)


class ItemStockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemStockMovement
        fields = "__all__"
        read_only_fields = ("created_by",)


# ── Dispensación ──────────────────────────────────────────────────────────────

class DispensingLineSerializer(serializers.ModelSerializer):
    deviation_percentage = serializers.FloatField(read_only=True)
    is_within_tolerance = serializers.BooleanField(read_only=True)

    class Meta:
        model = DispensingLine
        fields = "__all__"


class DispensingOrderSerializer(serializers.ModelSerializer):
    lines = DispensingLineSerializer(many=True, read_only=True)
    is_complete = serializers.BooleanField(read_only=True)

    class Meta:
        model = DispensingOrder
        fields = "__all__"


class RawMaterialIdentificationPrintSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawMaterialIdentificationPrint
        fields = "__all__"
        read_only_fields = ("printed_by", "printed_at")


# ── Instrucciones de fabricación ─────────────────────────────────────────────

class ManufacturingStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManufacturingStep
        fields = "__all__"


class ManufacturingStepExecutionSerializer(serializers.ModelSerializer):
    step_detail = ManufacturingStepSerializer(source="step", read_only=True)

    class Meta:
        model = ManufacturingStepExecution
        fields = "__all__"


# ── Despeje de línea y limpieza ──────────────────────────────────────────────

class LineClearanceCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LineClearanceCriterion
        fields = "__all__"


class LineClearanceSerializer(serializers.ModelSerializer):
    criteria = LineClearanceCriterionSerializer(many=True, read_only=True)

    class Meta:
        model = LineClearance
        fields = "__all__"


class CleaningRecordSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = CleaningRecord
        fields = "__all__"


class LineIdentificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = LineIdentification
        fields = "__all__"


# ── Control de producción ────────────────────────────────────────────────────

class ProductionControlMaterialSerializer(serializers.ModelSerializer):
    consumed_quantity = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)
    reconciliation_difference = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)

    class Meta:
        model = ProductionControlMaterial
        fields = "__all__"


class ProductionControlSerializer(serializers.ModelSerializer):
    materials = ProductionControlMaterialSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionControl
        fields = "__all__"


# ── Control de llenado ───────────────────────────────────────────────────────

class FillingParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = FillingParticipant
        fields = "__all__"


class FillingLogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FillingLogEntry
        fields = "__all__"


class FillingControlSerializer(serializers.ModelSerializer):
    participants = FillingParticipantSerializer(many=True, read_only=True)
    log_entries = FillingLogEntrySerializer(many=True, read_only=True)
    yield_percentage = serializers.FloatField(read_only=True)
    difference = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)

    class Meta:
        model = FillingControl
        fields = "__all__"


# ── Peso o volumen ────────────────────────────────────────────────────────────

class WeightVolumeSampleSerializer(serializers.ModelSerializer):
    net_weight = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)

    class Meta:
        model = WeightVolumeSample
        fields = "__all__"


class WeightVolumeControlSerializer(serializers.ModelSerializer):
    samples = WeightVolumeSampleSerializer(many=True, read_only=True)

    class Meta:
        model = WeightVolumeControl
        fields = "__all__"


# ── Hermeticidad ──────────────────────────────────────────────────────────────

class SealIntegritySampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SealIntegritySample
        fields = "__all__"


class SealIntegrityControlSerializer(serializers.ModelSerializer):
    samples = SealIntegritySampleSerializer(many=True, read_only=True)

    class Meta:
        model = SealIntegrityControl
        fields = "__all__"


# ── Acondicionamiento ─────────────────────────────────────────────────────────

class BatchLotMarkingSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchLotMarking
        fields = "__all__"


class PackagingControlSerializer(serializers.ModelSerializer):
    lot_markings = BatchLotMarkingSerializer(many=True, read_only=True)

    class Meta:
        model = PackagingControl
        fields = "__all__"


# ── Maestro de especificaciones de producto ──────────────────────────────────

class ProductSpecificationTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSpecificationTest
        fields = "__all__"


class ProductSpecificationSerializer(serializers.ModelSerializer):
    tests = ProductSpecificationTestSerializer(many=True, read_only=True)

    class Meta:
        model = ProductSpecification
        fields = "__all__"


# ── Certificado de análisis y microbiología ──────────────────────────────────

class AnalysisTestResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisTestResult
        fields = "__all__"


class AnalysisCertificateSerializer(serializers.ModelSerializer):
    tests = AnalysisTestResultSerializer(many=True, read_only=True)

    class Meta:
        model = AnalysisCertificate
        fields = "__all__"


class MicrobiologyAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = MicrobiologyAnalysis
        fields = "__all__"


# ── Verificación documental ───────────────────────────────────────────────────

class DocumentChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChecklistItem
        fields = "__all__"


class DocumentAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentAttachment
        fields = "__all__"
        read_only_fields = ("uploaded_by",)


# ── Liberación ────────────────────────────────────────────────────────────────

class BatchReleaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchRelease
        fields = "__all__"


class BatchExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchExport
        fields = "__all__"
        read_only_fields = ("generated_by", "file")
