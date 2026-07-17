from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models

from shared.infrastructure.models import BaseModel

SIGNATURE_EXTENSIONS = ("png", "jpg", "jpeg")
EVIDENCE_EXTENSIONS = ("pdf", "png", "jpg", "jpeg")


def signature_field(upload_to):
    """Firma electrónica: mismo patrón que Employee.signature y
    VacationRequestApprovalStep.signature (FileField + validador de imagen),
    consumido por SignaturePad.tsx en el frontend. No se crea un mecanismo
    nuevo de firma — se reutiliza el existente en cada paso que lo requiere."""
    return models.FileField(
        upload_to=upload_to,
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=SIGNATURE_EXTENSIONS)],
    )


def evidence_field(upload_to):
    return models.FileField(
        upload_to=upload_to,
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=EVIDENCE_EXTENSIONS)],
    )


class ResultStatus(models.TextChoices):
    """Catálogo común Sí/No/No aplica pedido para checklists (despeje, verificación
    documental, criterios de acondicionamiento, etc.). Un solo catálogo compartido
    en vez de repetir el enum en cada modelo."""
    YES = "YES", "Sí / Cumple"
    NO = "NO", "No / No cumple"
    NOT_APPLICABLE = "NOT_APPLICABLE", "No aplica"


class Batch(BaseModel):
    """Expediente de fabricación de un lote. Se apoya en apps.inventory.ProductionOrder
    (orden de producción ya existente: fórmula, cantidad planificada, numeración OP-xxxx)
    en lugar de duplicar esos datos — Batch agrega el seguimiento de expediente GMP
    (estado detallado, responsables, firmas, verificación documental) sobre esa orden."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        SCHEDULED = "SCHEDULED", "Programada"
        PENDING_DISPENSING = "PENDING_DISPENSING", "Pendiente de dispensación"
        DISPENSING = "DISPENSING", "En dispensación"
        DISPENSING_DONE = "DISPENSING_DONE", "Dispensación completada"
        MANUFACTURING = "MANUFACTURING", "En fabricación"
        BULK_PENDING_ANALYSIS = "BULK_PENDING_ANALYSIS", "Producto a granel pendiente de análisis"
        BULK_APPROVED = "BULK_APPROVED", "Producto a granel aprobado"
        FILLING = "FILLING", "En llenado"
        PACKAGING = "PACKAGING", "En acondicionamiento"
        FINISHED_QUARANTINE = "FINISHED_QUARANTINE", "Producto terminado en cuarentena"
        PENDING_DOCUMENTS = "PENDING_DOCUMENTS", "Pendiente de documentos"
        PENDING_MICROBIOLOGY = "PENDING_MICROBIOLOGY", "Pendiente de microbiología"
        RELEASED = "RELEASED", "Liberada"
        REJECTED = "REJECTED", "Rechazada"
        CLOSED = "CLOSED", "Cerrada"
        CANCELLED = "CANCELLED", "Cancelada"

    TERMINAL_STATUSES = (Status.RELEASED, Status.REJECTED, Status.CLOSED, Status.CANCELLED)

    production_order = models.OneToOneField(
        "inventory.ProductionOrder",
        on_delete=models.PROTECT,
        related_name="batch",
    )
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)

    # Área / línea: se referencian como texto libre porque el sistema todavía no
    # tiene un catálogo de áreas/líneas de producción (pendiente de confirmación
    # si debe modelarse como catálogo propio en una fase posterior).
    area = models.CharField(max_length=120, blank=True)
    production_line = models.CharField(max_length=120, blank=True)

    production_manager = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="batches_as_production_manager",
    )
    quality_manager = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="batches_as_quality_manager",
    )

    scheduled_at = models.DateField(null=True, blank=True)
    actual_start_at = models.DateTimeField(null=True, blank=True)
    actual_end_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_batches",
    )

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)

    def __str__(self):
        return f"Lote {self.production_order.batch_code or self.production_order.number}"

    @property
    def is_terminal(self):
        return self.status in self.TERMINAL_STATUSES


class BatchStatusHistory(BaseModel):
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="status_history")
    previous_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="batch_status_changes",
    )
    reason = models.CharField(max_length=255, blank=True)
    observation = models.TextField(blank=True)
    evidence = models.FileField(
        upload_to="manufacturing/batch-status-evidence/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg"))],
    )

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)
        verbose_name_plural = "batch status histories"


# ── Inventario de materias primas (lote/vencimiento + saldo real por bodega) ──
# inventory.Item ya existe (materia prima/insumo) con tracks_batches=True, pero
# el sistema no tenía todavía ni el concepto de lote de insumo ni su saldo real
# por ubicación (inventory.Stock solo cubre catalog.ProductVariant). Se agrega
# aquí porque es prerequisito directo de la dispensación pedida: no se puede
# dispensar, pesar ni bloquear materia prima vencida/en cuarentena sin esto.

class RawMaterialBatch(BaseModel):
    class QualityStatus(models.TextChoices):
        QUARANTINE = "QUARANTINE", "Cuarentena"
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"

    item = models.ForeignKey("inventory.Item", on_delete=models.PROTECT, related_name="raw_material_batches")
    supplier_batch_code = models.CharField(max_length=80)
    received_at = models.DateField(null=True, blank=True)
    expires_at = models.DateField(null=True, blank=True)
    analysis_number = models.CharField(max_length=80, blank=True)
    quality_status = models.CharField(max_length=20, choices=QualityStatus.choices, default=QualityStatus.QUARANTINE)
    supplier = models.ForeignKey(
        "inventory.Supplier", on_delete=models.SET_NULL, null=True, blank=True, related_name="raw_material_batches"
    )
    notes = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-received_at", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("item", "supplier_batch_code"), name="unique_raw_material_batch_per_item"),
        ]

    def __str__(self):
        return f"{self.item.code} · Lote {self.supplier_batch_code}"

    @property
    def is_expired(self):
        from django.utils import timezone
        return bool(self.expires_at) and self.expires_at < timezone.localdate()

    @property
    def is_usable(self):
        return self.quality_status == self.QualityStatus.APPROVED and not self.is_expired


class ItemStock(BaseModel):
    """Saldo real de materia prima por bodega/ubicación y lote — equivalente de
    inventory.Stock (que solo cubre ProductVariant) pero para Item + lote."""

    item = models.ForeignKey("inventory.Item", on_delete=models.PROTECT, related_name="stocks")
    location = models.ForeignKey("inventory.Location", on_delete=models.PROTECT, related_name="item_stocks")
    raw_material_batch = models.ForeignKey(
        RawMaterialBatch, on_delete=models.PROTECT, null=True, blank=True, related_name="stocks"
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    reserved_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta(BaseModel.Meta):
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(
                fields=("item", "location", "raw_material_batch"), name="unique_item_stock_per_location_batch"
            ),
            models.CheckConstraint(condition=models.Q(quantity__gte=0), name="item_stock_quantity_non_negative"),
            models.CheckConstraint(
                condition=models.Q(reserved_quantity__gte=0), name="item_stock_reserved_non_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(reserved_quantity__lte=models.F("quantity")),
                name="item_stock_reserved_lte_quantity",
            ),
        ]

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity


class ItemStockMovement(BaseModel):
    """Espejo de inventory.InventoryMovement pero para Item + lote de materia
    prima. Se mantiene separado (no se generaliza InventoryMovement) para no
    modificar un modelo del módulo de inventario ya en uso por catalog/commerce."""

    class Type(models.TextChoices):
        ENTRY = "ENTRY", "Entrada"
        EXIT = "EXIT", "Salida"
        DISPENSING = "DISPENSING", "Dispensación"
        RETURN = "RETURN", "Devolución"
        LOSS = "LOSS", "Merma"
        ADJUSTMENT_IN = "ADJUSTMENT_IN", "Ajuste positivo"
        ADJUSTMENT_OUT = "ADJUSTMENT_OUT", "Ajuste negativo"

    item = models.ForeignKey("inventory.Item", on_delete=models.PROTECT, related_name="stock_movements")
    location = models.ForeignKey("inventory.Location", on_delete=models.PROTECT, related_name="item_movements")
    raw_material_batch = models.ForeignKey(
        RawMaterialBatch, on_delete=models.PROTECT, null=True, blank=True, related_name="movements"
    )
    movement_type = models.CharField(max_length=30, choices=Type.choices)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    reason = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="item_stock_movements"
    )


# ── Dispensación ───────────────────────────────────────────────────────────────

class DispensingOrder(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        IN_PROGRESS = "IN_PROGRESS", "En proceso"
        COMPLETED = "COMPLETED", "Completada"

    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="dispensing_order")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    issued_at = models.DateField(null=True, blank=True)
    responsible = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="dispensing_orders_as_responsible"
    )
    verifier = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="dispensing_orders_as_verifier"
    )
    responsible_signature = signature_field("manufacturing/dispensing/signatures/")
    verifier_signature = signature_field("manufacturing/dispensing/signatures/")

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)

    def __str__(self):
        return f"Dispensación {self.batch}"

    @property
    def is_complete(self):
        return not self.lines.exclude(status=DispensingLine.Status.CLOSED).exists()


class DispensingLine(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        WEIGHED = "WEIGHED", "Pesado"
        VERIFIED = "VERIFIED", "Verificado"
        CLOSED = "CLOSED", "Cerrado"

    order = models.ForeignKey(DispensingOrder, on_delete=models.CASCADE, related_name="lines")
    sequence = models.PositiveSmallIntegerField(default=1)
    formula_line = models.ForeignKey(
        "inventory.FormulaLine", on_delete=models.PROTECT, related_name="dispensing_lines", null=True, blank=True
    )
    item = models.ForeignKey("inventory.Item", on_delete=models.PROTECT, related_name="dispensing_lines")
    raw_material_batch = models.ForeignKey(
        RawMaterialBatch, on_delete=models.PROTECT, null=True, blank=True, related_name="dispensing_lines"
    )
    theoretical_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    tolerance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tare = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    gross_weight = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    net_weight = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    container = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    weighed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="dispensing_lines_weighed"
    )
    weighed_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="dispensing_lines_verified"
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    additional_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    added_at = models.DateTimeField(null=True, blank=True)
    added_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="dispensing_lines_added"
    )

    returned_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    return_reason = models.TextField(blank=True)
    received_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="dispensing_lines_received"
    )

    observations = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("sequence", "created_at")

    @property
    def deviation_percentage(self):
        if not self.net_weight or not self.theoretical_quantity:
            return None
        return ((self.net_weight - self.theoretical_quantity) / self.theoretical_quantity) * 100

    @property
    def is_within_tolerance(self):
        deviation = self.deviation_percentage
        if deviation is None:
            return None
        return abs(deviation) <= float(self.tolerance_percentage)


class RawMaterialIdentificationPrint(BaseModel):
    """Registro de impresión/reimpresión de la identificación de materia prima
    dispensada (etiqueta con QR). No genera un mecanismo de impresión nuevo:
    solo registra cuántas veces y por qué se reimprimió cada pesada, y el PDF
    se genera con el mismo patrón reportlab usado en el resto del sistema."""

    dispensing_line = models.ForeignKey(DispensingLine, on_delete=models.CASCADE, related_name="identification_prints")
    printed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    printed_at = models.DateTimeField(auto_now_add=True)
    is_reprint = models.BooleanField(default=False)
    reprint_reason = models.CharField(max_length=255, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-printed_at",)


# ── Instrucciones de fabricación ───────────────────────────────────────────────
# Los pasos viven en el maestro (ligados a Formula, no a Batch) para que la
# orden de producción no pueda "inventar" instrucciones — solo las ejecuta.
# Cada Batch obtiene su propia ejecución (ManufacturingStepExecution) por paso.

class ManufacturingStep(BaseModel):
    formula = models.ForeignKey("inventory.Formula", on_delete=models.CASCADE, related_name="manufacturing_steps")
    sequence = models.PositiveSmallIntegerField()
    phase = models.CharField(max_length=120, blank=True)
    instruction = models.TextField()
    formula_line = models.ForeignKey(
        "inventory.FormulaLine", on_delete=models.SET_NULL, null=True, blank=True, related_name="manufacturing_steps"
    )
    required_equipment = models.CharField(max_length=120, blank=True)
    target_temperature = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    target_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    target_agitation_speed = models.CharField(max_length=60, blank=True)
    target_ph = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    target_pressure = models.CharField(max_length=60, blank=True)
    is_mandatory = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ("formula", "sequence")
        constraints = [
            models.UniqueConstraint(fields=("formula", "sequence"), name="unique_manufacturing_step_sequence"),
        ]

    def __str__(self):
        return f"{self.formula.code} · Paso {self.sequence}"


class ManufacturingStepExecution(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        IN_PROGRESS = "IN_PROGRESS", "En proceso"
        PAUSED = "PAUSED", "Pausado"
        COMPLETED = "COMPLETED", "Completado"
        DEVIATED = "DEVIATED", "Con desviación"

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="step_executions")
    step = models.ForeignKey(ManufacturingStep, on_delete=models.PROTECT, related_name="executions")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    actual_quantity = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    actual_temperature = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    actual_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    actual_agitation_speed = models.CharField(max_length=60, blank=True)
    actual_ph = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    actual_pressure = models.CharField(max_length=60, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="step_executions_performed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="step_executions_verified"
    )
    observations = models.TextField(blank=True)
    deviation = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("batch", "step__sequence")
        constraints = [
            models.UniqueConstraint(fields=("batch", "step"), name="unique_step_execution_per_batch"),
        ]


# ── Despeje de línea y limpieza ────────────────────────────────────────────────

class LineClearance(BaseModel):
    class Phase(models.TextChoices):
        DISPENSING = "DISPENSING", "Dispensación"
        MANUFACTURING = "MANUFACTURING", "Fabricación"
        FILLING = "FILLING", "Llenado"
        PACKAGING = "PACKAGING", "Acondicionamiento"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="line_clearances")
    phase = models.CharField(max_length=20, choices=Phase.choices)
    area = models.CharField(max_length=120, blank=True)
    production_line = models.CharField(max_length=120, blank=True)
    cleared_at = models.DateTimeField(null=True, blank=True)
    previous_product = models.CharField(max_length=180, blank=True)
    previous_batch_code = models.CharField(max_length=60, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="line_clearances_performed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="line_clearances_verified"
    )
    verifier_signature = signature_field("manufacturing/line-clearance/signatures/")

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


class LineClearanceCriterion(BaseModel):
    CRITERIA_CHOICES = (
        ("SANITATION", "Limpieza y sanitización"),
        ("NO_OTHER_MATERIALS", "Ausencia de materiales de otros productos"),
        ("EQUIPMENT_CONDITION", "Equipos en condiciones adecuadas"),
        ("NO_OTHER_DOCUMENTS", "Ausencia de documentos de otra orden"),
        ("NO_OTHER_LABELS", "Ausencia de etiquetas de otro producto"),
        ("CURRENT_MATERIALS_IDENTIFIED", "Materiales actuales correctamente identificados"),
        ("AREA_IDENTIFIED", "Área correctamente identificada"),
    )

    clearance = models.ForeignKey(LineClearance, on_delete=models.CASCADE, related_name="criteria")
    criterion = models.CharField(max_length=40, choices=CRITERIA_CHOICES)
    result = models.CharField(max_length=20, choices=ResultStatus.choices, default=ResultStatus.NOT_APPLICABLE)
    observation = models.TextField(blank=True)
    evidence = evidence_field("manufacturing/line-clearance/evidence/")
    corrective_action_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="clearance_corrections"
    )
    corrective_action = models.TextField(blank=True)
    corrected_at = models.DateTimeField(null=True, blank=True)
    reinspection_result = models.CharField(max_length=20, choices=ResultStatus.choices, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("created_at",)


class CleaningRecord(BaseModel):
    class Type(models.TextChoices):
        AREA = "AREA", "Área limpia"
        EQUIPMENT = "EQUIPMENT", "Equipo limpio"

    class Result(models.TextChoices):
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="cleaning_records")
    record_type = models.CharField(max_length=20, choices=Type.choices)
    area = models.CharField(max_length=120, blank=True)
    equipment = models.CharField(max_length=120, blank=True)
    equipment_code = models.CharField(max_length=60, blank=True)
    cleaned_at = models.DateTimeField(null=True, blank=True)
    previous_product = models.CharField(max_length=180, blank=True)
    previous_batch_code = models.CharField(max_length=60, blank=True)
    cleaning_method = models.TextField(blank=True)
    sanitizer = models.CharField(max_length=180, blank=True)
    sanitizer_concentration = models.CharField(max_length=60, blank=True)
    sanitizer_batch = models.CharField(max_length=60, blank=True)
    sanitizer_expires_at = models.DateField(null=True, blank=True)
    performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="cleaning_records_performed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="cleaning_records_verified"
    )
    result = models.CharField(max_length=20, choices=Result.choices, null=True, blank=True)
    observations = models.TextField(blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-cleaned_at", "-created_at")

    @property
    def is_expired(self):
        from django.utils import timezone
        return bool(self.valid_until) and self.valid_until < timezone.now()


# ── Identificación de línea ─────────────────────────────────────────────────────

class LineIdentification(BaseModel):
    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="line_identification")
    area = models.CharField(max_length=120, blank=True)
    production_line = models.CharField(max_length=120, blank=True)
    placed_at = models.DateTimeField(null=True, blank=True)
    placed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="line_identifications_placed"
    )
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="line_identifications_removed"
    )

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


# ── Control de producción (materiales de acondicionamiento) ────────────────────

class ProductionControl(BaseModel):
    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="production_control")
    lot_size = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    unit = models.ForeignKey("inventory.UnitOfMeasure", on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


class ProductionControlMaterial(BaseModel):
    control = models.ForeignKey(ProductionControl, on_delete=models.CASCADE, related_name="materials")
    item = models.ForeignKey("inventory.Item", on_delete=models.PROTECT, related_name="production_control_lines")
    requested_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    delivered_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    delivered_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="production_materials_delivered"
    )
    received_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="production_materials_received"
    )
    delivered_at = models.DateTimeField(null=True, blank=True)

    returned_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    return_received_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="production_materials_return_received"
    )
    return_reason = models.TextField(blank=True)

    additional_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    additional_reason = models.TextField(blank=True)

    good_units = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    process_rejects = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    factory_rejects = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    observations = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("created_at",)

    @property
    def consumed_quantity(self):
        return self.delivered_quantity + self.additional_quantity - self.returned_quantity

    @property
    def reconciliation_difference(self):
        accounted = self.good_units + self.process_rejects + self.factory_rejects
        return self.consumed_quantity - accounted


# ── Control de llenado ──────────────────────────────────────────────────────────

class FillingControl(BaseModel):
    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="filling_control")
    production_line = models.CharField(max_length=120, blank=True)
    equipment = models.CharField(max_length=120, blank=True)
    source_tank = models.CharField(max_length=120, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    responsible = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="filling_controls_as_responsible"
    )
    verifier = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="filling_controls_as_verifier"
    )
    planned_quantity = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    produced_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    rejected_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    recovered_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    justification = models.TextField(blank=True)
    observations = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)

    @property
    def yield_percentage(self):
        if not self.planned_quantity:
            return None
        return (self.produced_quantity / self.planned_quantity) * 100

    @property
    def difference(self):
        if self.planned_quantity is None:
            return None
        return self.produced_quantity - self.planned_quantity


class FillingParticipant(BaseModel):
    control = models.ForeignKey(FillingControl, on_delete=models.CASCADE, related_name="participants")
    employee = models.ForeignKey("employees.Employee", on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=120, blank=True)
    activity = models.CharField(max_length=180, blank=True)
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    signature = signature_field("manufacturing/filling/signatures/")

    class Meta(BaseModel.Meta):
        ordering = ("created_at",)


class FillingLogEntry(BaseModel):
    control = models.ForeignKey(FillingControl, on_delete=models.CASCADE, related_name="log_entries")
    recorded_at = models.DateTimeField()
    units_produced = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    displays = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    boxes = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    units_rejected = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    rejection_reason = models.CharField(max_length=255, blank=True)
    performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="filling_log_entries_performed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="filling_log_entries_verified"
    )
    observations = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("recorded_at",)


# ── Control de peso o volumen ────────────────────────────────────────────────────

class WeightVolumeControl(BaseModel):
    class OverallResult(models.TextChoices):
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"
        PENDING = "PENDING", "Pendiente"

    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="weight_volume_control")
    tare = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    lower_limit = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    upper_limit = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    unit = models.ForeignKey("inventory.UnitOfMeasure", on_delete=models.SET_NULL, null=True, blank=True)
    performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="weight_controls_performed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="weight_controls_verified"
    )
    overall_result = models.CharField(max_length=20, choices=OverallResult.choices, default=OverallResult.PENDING)
    resumed_authorized_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="weight_controls_authorized_resume"
    )

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


class WeightVolumeSample(BaseModel):
    control = models.ForeignKey(WeightVolumeControl, on_delete=models.CASCADE, related_name="samples")
    sample_number = models.PositiveSmallIntegerField()
    sampled_at = models.DateTimeField(null=True, blank=True)
    gross_weight = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    tare = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    volume = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    result = models.CharField(max_length=20, choices=ResultStatus.choices, default=ResultStatus.NOT_APPLICABLE)
    observation = models.TextField(blank=True)
    adjustment_made = models.TextField(blank=True)
    adjustment_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="weight_sample_adjustments"
    )

    class Meta(BaseModel.Meta):
        ordering = ("sample_number",)
        constraints = [
            models.UniqueConstraint(fields=("control", "sample_number"), name="unique_weight_sample_number"),
        ]

    @property
    def net_weight(self):
        if self.gross_weight is None or self.tare is None:
            return None
        return self.gross_weight - self.tare


# ── Control de hermeticidad ───────────────────────────────────────────────────────

class SealIntegrityControl(BaseModel):
    class OverallResult(models.TextChoices):
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"
        REPEAT = "REPEAT", "Repetir ensayo"
        PENDING = "PENDING", "Pendiente"

    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="seal_integrity_control")
    tested_at = models.DateTimeField(null=True, blank=True)
    equipment = models.CharField(max_length=120, blank=True)
    equipment_code = models.CharField(max_length=60, blank=True)
    pressure_bar = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    time_seconds = models.PositiveIntegerField(null=True, blank=True)
    performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="seal_controls_performed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="seal_controls_verified"
    )
    observations = models.TextField(blank=True)
    overall_result = models.CharField(max_length=20, choices=OverallResult.choices, default=OverallResult.PENDING)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


class SealIntegritySample(BaseModel):
    class Result(models.TextChoices):
        CONFORMING = "CONFORMING", "Conforme"
        LEAK = "LEAK", "Fuga"
        DEFORMATION = "DEFORMATION", "Deformación"
        RUPTURE = "RUPTURE", "Ruptura"
        OTHER = "OTHER", "Otro"

    control = models.ForeignKey(SealIntegrityControl, on_delete=models.CASCADE, related_name="samples")
    sample_number = models.PositiveSmallIntegerField()
    result = models.CharField(max_length=20, choices=Result.choices)
    observation = models.TextField(blank=True)
    evidence = evidence_field("manufacturing/seal-integrity/evidence/")

    class Meta(BaseModel.Meta):
        ordering = ("sample_number",)
        constraints = [
            models.UniqueConstraint(fields=("control", "sample_number"), name="unique_seal_sample_number"),
        ]


# ── Control de acondicionamiento ─────────────────────────────────────────────────

class PackagingControl(BaseModel):
    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="packaging_control")
    responsible = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="packaging_controls_as_responsible"
    )
    verifier = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="packaging_controls_as_verifier"
    )

    # Etiqueta testigo
    label_sample_file = evidence_field("manufacturing/packaging/label-sample/")
    label_code = models.CharField(max_length=80, blank=True)
    artwork_version = models.CharField(max_length=40, blank=True)
    label_material_batch = models.CharField(max_length=60, blank=True)
    label_result = models.CharField(max_length=20, choices=ResultStatus.choices, blank=True)
    label_observations = models.TextField(blank=True)
    label_performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="packaging_label_performed"
    )
    label_verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="packaging_label_verified"
    )

    # Empaque / conciliación
    units_per_display = models.PositiveIntegerField(null=True, blank=True)
    displays_per_box = models.PositiveIntegerField(null=True, blank=True)
    units_per_box = models.PositiveIntegerField(null=True, blank=True)
    complete_boxes = models.PositiveIntegerField(default=0)
    incomplete_displays = models.PositiveIntegerField(default=0)
    loose_units = models.PositiveIntegerField(default=0)
    total_reconciled = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    balances = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    rejections = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    rejection_reasons = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


class BatchLotMarking(BaseModel):
    class Stage(models.TextChoices):
        INITIAL = "INITIAL", "Loteado inicial"
        FINAL = "FINAL", "Loteado final"

    packaging_control = models.ForeignKey(PackagingControl, on_delete=models.CASCADE, related_name="lot_markings")
    stage = models.CharField(max_length=20, choices=Stage.choices)
    photo = evidence_field("manufacturing/packaging/lot-marking/")
    printed_batch_code = models.CharField(max_length=60, blank=True)
    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    printed_at = models.DateTimeField(null=True, blank=True)
    is_legible = models.BooleanField(null=True, blank=True)
    is_correctly_placed = models.BooleanField(null=True, blank=True)
    result = models.CharField(max_length=20, choices=ResultStatus.choices, blank=True)
    performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="lot_markings_performed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="lot_markings_verified"
    )

    class Meta(BaseModel.Meta):
        ordering = ("stage", "created_at")


# ── Maestro de especificaciones de producto ──────────────────────────────────
# Catálogo de ensayos (nombre, unidad, límites, método, equipo) por producto
# (Item), reutilizable entre certificados de análisis y análisis microbiológicos
# de todos los lotes de ese producto — evita digitar la especificación cada vez.

class ProductSpecification(BaseModel):
    item = models.OneToOneField("inventory.Item", on_delete=models.CASCADE, related_name="specification")
    version = models.CharField(max_length=20, default="1.0")
    effective_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)

    def __str__(self):
        return f"Especificación {self.item.code} v{self.version}"


class ProductSpecificationTest(BaseModel):
    class Category(models.TextChoices):
        PHYSICOCHEMICAL = "PHYSICOCHEMICAL", "Fisicoquímico"
        MICROBIOLOGICAL = "MICROBIOLOGICAL", "Microbiológico"

    specification = models.ForeignKey(ProductSpecification, on_delete=models.CASCADE, related_name="tests")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.PHYSICOCHEMICAL)
    sequence = models.PositiveSmallIntegerField(default=1)
    name = models.CharField(max_length=120)
    unit = models.CharField(max_length=40, blank=True)
    specification_text = models.CharField(max_length=255, blank=True)
    lower_limit = models.CharField(max_length=60, blank=True)
    upper_limit = models.CharField(max_length=60, blank=True)
    method = models.CharField(max_length=180, blank=True)
    equipment = models.CharField(max_length=120, blank=True)
    equipment_parameters = models.CharField(max_length=255, blank=True)
    is_mandatory = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ("specification", "category", "sequence")
        constraints = [
            models.UniqueConstraint(fields=("specification", "category", "sequence"), name="unique_spec_test_sequence"),
        ]

    def __str__(self):
        return f"{self.specification.item.code} · {self.name}"


# ── Certificado de análisis y microbiología ─────────────────────────────────────
# Las especificaciones/ensayos por defecto provienen del maestro de
# especificaciones (ProductSpecification) cuando existe para el producto del
# lote; AnalysisTestResult conserva sus propios campos porque cada resultado es
# específico de ese lote (no modifica el maestro).

class AnalysisCertificate(BaseModel):
    class Concept(models.TextChoices):
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"
        QUARANTINE = "QUARANTINE", "Cuarentena"
        REANALYSIS = "REANALYSIS", "Reanálisis"

    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="analysis_certificate")
    manufactured_at = models.DateField(null=True, blank=True)
    sampled_at = models.DateField(null=True, blank=True)
    analyzed_at = models.DateField(null=True, blank=True)
    analyzed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="analysis_certificates_analyzed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="analysis_certificates_verified"
    )
    concept = models.CharField(max_length=20, choices=Concept.choices, default=Concept.QUARANTINE)
    observations = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


class AnalysisTestResult(BaseModel):
    certificate = models.ForeignKey(AnalysisCertificate, on_delete=models.CASCADE, related_name="tests")
    name = models.CharField(max_length=120)
    result_type = models.CharField(max_length=40, blank=True)
    unit = models.CharField(max_length=40, blank=True)
    specification = models.CharField(max_length=255, blank=True)
    lower_limit = models.CharField(max_length=60, blank=True)
    upper_limit = models.CharField(max_length=60, blank=True)
    method = models.CharField(max_length=180, blank=True)
    equipment = models.CharField(max_length=120, blank=True)
    equipment_parameters = models.CharField(max_length=255, blank=True)
    bulk_result = models.CharField(max_length=120, blank=True)
    finished_product_result = models.CharField(max_length=120, blank=True)
    complies = models.BooleanField(null=True, blank=True)
    observations = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="analysis_tests_performed"
    )
    verified_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="analysis_tests_verified"
    )

    class Meta(BaseModel.Meta):
        ordering = ("created_at",)


class MicrobiologyAnalysis(BaseModel):
    class OverallResult(models.TextChoices):
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"
        PENDING = "PENDING", "Pendiente"

    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="microbiology_analysis")
    sample_code = models.CharField(max_length=80, blank=True)
    sample_type = models.CharField(max_length=120, blank=True)
    taken_at = models.DateField(null=True, blank=True)
    taken_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="microbiology_samples_taken"
    )
    sent_at = models.DateField(null=True, blank=True)
    laboratory = models.CharField(max_length=180, blank=True)
    report_number = models.CharField(max_length=80, blank=True)
    results = models.JSONField(default=list, blank=True)
    specifications = models.JSONField(default=list, blank=True)
    overall_result = models.CharField(max_length=20, choices=OverallResult.choices, default=OverallResult.PENDING)
    report_file = evidence_field("manufacturing/microbiology/reports/")
    approved_at = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="microbiology_approved"
    )
    observations = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)
        verbose_name_plural = "microbiology analyses"


# ── Verificación documental ─────────────────────────────────────────────────────

class DocumentChecklistItem(BaseModel):
    class DocumentCode(models.TextChoices):
        PRODUCTION_CONTROL = "PRODUCTION_CONTROL", "Control de producción"
        LINE_CLEARANCE = "LINE_CLEARANCE", "Despeje de línea de áreas y equipos"
        CLEAN_AREA_EQUIPMENT = "CLEAN_AREA_EQUIPMENT", "Área y equipo limpio"
        DISPENSING_ORDER = "DISPENSING_ORDER", "Orden de dispensación y fabricación"
        RAW_MATERIAL_IDENTIFICATION = "RAW_MATERIAL_IDENTIFICATION", "Identificación de materia prima dispensada"
        ANALYSIS_CERTIFICATE = "ANALYSIS_CERTIFICATE", "Certificado de análisis de producto a granel y terminado"
        MICROBIOLOGY = "MICROBIOLOGY", "Análisis microbiológico"
        LINE_IDENTIFICATION = "LINE_IDENTIFICATION", "Identificación de línea"
        FILLING_CONTROL = "FILLING_CONTROL", "Control de llenado"
        RELEASE = "RELEASE", "Liberación de producto terminado"
        PACKAGING_CONTROL = "PACKAGING_CONTROL", "Control de acondicionamiento"
        SEAL_INTEGRITY = "SEAL_INTEGRITY", "Control de hermeticidad"
        WEIGHT_VOLUME = "WEIGHT_VOLUME", "Control de peso o volumen"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        IN_PROGRESS = "IN_PROGRESS", "En proceso"
        FILLED = "FILLED", "Diligenciado"
        REVIEWED = "REVIEWED", "Revisado"
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="document_checklist")
    document_code = models.CharField(max_length=40, choices=DocumentCode.choices)
    name = models.CharField(max_length=180)
    format_code = models.CharField(max_length=40, blank=True)
    format_version = models.CharField(max_length=20, blank=True)
    applies = models.BooleanField(default=True)
    result = models.CharField(max_length=20, choices=ResultStatus.choices, default=ResultStatus.NOT_APPLICABLE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    responsible = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="document_checklist_responsible"
    )
    verifier = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="document_checklist_verified"
    )
    filled_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    observations = models.TextField(blank=True)
    generated_file = evidence_field("manufacturing/document-checklist/generated/")
    blocks_release = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ("batch", "document_code")
        constraints = [
            models.UniqueConstraint(fields=("batch", "document_code"), name="unique_document_checklist_item_per_batch"),
        ]


class DocumentAttachment(BaseModel):
    """Archivos/evidencias adjuntos a cualquier fase del expediente (fotos,
    PDFs, certificados). Usa el storage de Django estándar, igual que el resto
    del sistema (Employee.photo, EmployeeDocument.file, etc.) — no crea un
    mecanismo de almacenamiento nuevo."""

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="attachments")
    document_code = models.CharField(max_length=40, blank=True)
    file = models.FileField(
        upload_to="manufacturing/attachments/",
        validators=[FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg", "doc", "docx"))],
    )
    original_name = models.CharField(max_length=255, blank=True)
    description = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)


# ── Liberación de producto terminado ─────────────────────────────────────────────

class BatchRelease(BaseModel):
    class Condition(models.TextChoices):
        RELEASED = "RELEASED", "Liberado"
        CONDITIONAL = "CONDITIONAL", "Liberado condicional"
        REJECTED = "REJECTED", "Rechazado"

    batch = models.OneToOneField(Batch, on_delete=models.CASCADE, related_name="release")
    released_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    retained_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    rejected_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unit = models.ForeignKey("inventory.UnitOfMeasure", on_delete=models.SET_NULL, null=True, blank=True)
    warehouse_location = models.ForeignKey("inventory.Location", on_delete=models.SET_NULL, null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    condition = models.CharField(max_length=20, choices=Condition.choices, default=Condition.CONDITIONAL)
    released_by_quality = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="releases_by_quality"
    )
    quality_signature = signature_field("manufacturing/release/signatures/")
    approved_by_technical_director = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="releases_approved_technical_director"
    )
    technical_director_signature = signature_field("manufacturing/release/signatures/")
    observations = models.TextField(blank=True)
    release_document = evidence_field("manufacturing/release/documents/")

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)

    def __str__(self):
        return f"Liberación {self.batch}"


class BatchExport(BaseModel):
    """Registro de cada generación del expediente completo (o de un documento
    individual) en PDF, para no perder versiones anteriores una vez el lote
    esté cerrado, tal como exige el requerimiento."""

    class Kind(models.TextChoices):
        FULL_DOSSIER = "FULL_DOSSIER", "Expediente completo"
        SINGLE_DOCUMENT = "SINGLE_DOCUMENT", "Documento individual"

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="exports")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    document_code = models.CharField(max_length=40, blank=True)
    include_attachments = models.BooleanField(default=True)
    include_photos = models.BooleanField(default=True)
    include_not_applicable = models.BooleanField(default=False)
    file = models.FileField(upload_to="manufacturing/exports/")
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ("-created_at",)
