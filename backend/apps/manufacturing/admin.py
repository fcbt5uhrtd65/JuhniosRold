from django.contrib import admin

from .models import (
    AnalysisCertificate,
    Area,
    Batch,
    BatchRelease,
    BatchStatusHistory,
    DispensingOrder,
    DocumentChecklistItem,
    ItemStock,
    LineClearance,
    ProductionLine,
    ProductSpecification,
    RawMaterialBatch,
)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")


@admin.register(ProductionLine)
class ProductionLineAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "area", "is_active")
    list_filter = ("is_active", "area")
    search_fields = ("code", "name")
    list_select_related = ("area",)


@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):
    list_display = ("production_order", "status", "production_manager", "quality_manager", "scheduled_at")
    list_filter = ("status", "scheduled_at")
    search_fields = ("production_order__number", "production_order__batch_code")
    list_select_related = ("production_order", "production_manager", "quality_manager")


@admin.register(BatchStatusHistory)
class BatchStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("batch", "previous_status", "new_status", "changed_by", "created_at")
    list_filter = ("new_status", "created_at")
    search_fields = ("batch__production_order__number", "reason")
    list_select_related = ("batch", "changed_by")


@admin.register(RawMaterialBatch)
class RawMaterialBatchAdmin(admin.ModelAdmin):
    list_display = ("item", "supplier_batch_code", "quality_status", "expires_at", "received_at")
    list_filter = ("quality_status", "expires_at")
    search_fields = ("item__code", "item__name", "supplier_batch_code", "analysis_number")
    list_select_related = ("item", "supplier")


@admin.register(ItemStock)
class ItemStockAdmin(admin.ModelAdmin):
    list_display = ("item", "location", "raw_material_batch", "quantity", "reserved_quantity")
    list_filter = ("location",)
    search_fields = ("item__code", "item__name")
    list_select_related = ("item", "location", "raw_material_batch")


@admin.register(DispensingOrder)
class DispensingOrderAdmin(admin.ModelAdmin):
    list_display = ("batch", "status", "responsible", "verifier", "issued_at")
    list_filter = ("status", "issued_at")
    search_fields = ("batch__production_order__number",)
    list_select_related = ("batch", "responsible", "verifier")


@admin.register(LineClearance)
class LineClearanceAdmin(admin.ModelAdmin):
    list_display = ("batch", "phase", "status", "performed_by", "verified_by", "cleared_at")
    list_filter = ("phase", "status")
    search_fields = ("batch__production_order__number",)
    list_select_related = ("batch", "performed_by", "verified_by")


@admin.register(AnalysisCertificate)
class AnalysisCertificateAdmin(admin.ModelAdmin):
    list_display = ("batch", "concept", "analyzed_by", "verified_by", "analyzed_at")
    list_filter = ("concept",)
    search_fields = ("batch__production_order__number",)
    list_select_related = ("batch", "analyzed_by", "verified_by")


@admin.register(DocumentChecklistItem)
class DocumentChecklistItemAdmin(admin.ModelAdmin):
    list_display = ("batch", "document_code", "status", "result", "applies")
    list_filter = ("document_code", "status", "result", "applies")
    search_fields = ("batch__production_order__number", "name")
    list_select_related = ("batch", "responsible", "verifier")


@admin.register(BatchRelease)
class BatchReleaseAdmin(admin.ModelAdmin):
    list_display = ("batch", "condition", "released_quantity", "released_by_quality", "released_at")
    list_filter = ("condition",)
    search_fields = ("batch__production_order__number",)
    list_select_related = ("batch", "released_by_quality", "approved_by_technical_director")


@admin.register(ProductSpecification)
class ProductSpecificationAdmin(admin.ModelAdmin):
    list_display = ("item", "version", "effective_date", "is_active")
    list_filter = ("is_active",)
    search_fields = ("item__code", "item__name")
    list_select_related = ("item",)
