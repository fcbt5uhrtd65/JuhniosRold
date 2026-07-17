from rest_framework.routers import DefaultRouter

from .views import (
    AnalysisCertificateViewSet,
    AnalysisTestResultViewSet,
    BatchExportViewSet,
    BatchLotMarkingViewSet,
    BatchReleaseViewSet,
    BatchViewSet,
    CleaningRecordViewSet,
    DispensingLineViewSet,
    DispensingOrderViewSet,
    DocumentAttachmentViewSet,
    DocumentChecklistItemViewSet,
    FillingControlViewSet,
    FillingLogEntryViewSet,
    FillingParticipantViewSet,
    ItemStockMovementViewSet,
    ItemStockViewSet,
    LineClearanceCriterionViewSet,
    LineClearanceViewSet,
    LineIdentificationViewSet,
    ManufacturingStepExecutionViewSet,
    ManufacturingStepViewSet,
    MicrobiologyAnalysisViewSet,
    PackagingControlViewSet,
    ProductionControlMaterialViewSet,
    ProductionControlViewSet,
    RawMaterialBatchViewSet,
    RawMaterialIdentificationPrintViewSet,
    SealIntegrityControlViewSet,
    SealIntegritySampleViewSet,
    WeightVolumeControlViewSet,
    WeightVolumeSampleViewSet,
)

router = DefaultRouter()
router.register("batches", BatchViewSet)
router.register("raw-material-batches", RawMaterialBatchViewSet)
router.register("item-stocks", ItemStockViewSet)
router.register("item-stock-movements", ItemStockMovementViewSet)
router.register("dispensing-orders", DispensingOrderViewSet)
router.register("dispensing-lines", DispensingLineViewSet)
router.register("raw-material-identification-prints", RawMaterialIdentificationPrintViewSet)
router.register("manufacturing-steps", ManufacturingStepViewSet)
router.register("manufacturing-step-executions", ManufacturingStepExecutionViewSet)
router.register("line-clearances", LineClearanceViewSet)
router.register("line-clearance-criteria", LineClearanceCriterionViewSet)
router.register("cleaning-records", CleaningRecordViewSet)
router.register("line-identifications", LineIdentificationViewSet)
router.register("production-controls", ProductionControlViewSet)
router.register("production-control-materials", ProductionControlMaterialViewSet)
router.register("filling-controls", FillingControlViewSet)
router.register("filling-participants", FillingParticipantViewSet)
router.register("filling-log-entries", FillingLogEntryViewSet)
router.register("weight-volume-controls", WeightVolumeControlViewSet)
router.register("weight-volume-samples", WeightVolumeSampleViewSet)
router.register("seal-integrity-controls", SealIntegrityControlViewSet)
router.register("seal-integrity-samples", SealIntegritySampleViewSet)
router.register("packaging-controls", PackagingControlViewSet)
router.register("batch-lot-markings", BatchLotMarkingViewSet)
router.register("analysis-certificates", AnalysisCertificateViewSet)
router.register("analysis-test-results", AnalysisTestResultViewSet)
router.register("microbiology-analyses", MicrobiologyAnalysisViewSet)
router.register("document-checklist-items", DocumentChecklistItemViewSet)
router.register("document-attachments", DocumentAttachmentViewSet)
router.register("batch-releases", BatchReleaseViewSet)
router.register("batch-exports", BatchExportViewSet)

urlpatterns = [
    *router.urls,
]
