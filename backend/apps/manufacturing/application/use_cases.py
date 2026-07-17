from django.db import transaction
from django.utils import timezone

from shared.domain.exceptions import BusinessRuleViolation

from ..infrastructure.models import (
    Batch,
    BatchRelease,
    BatchStatusHistory,
    DispensingLine,
    DispensingOrder,
    DocumentChecklistItem,
    ItemStock,
    ItemStockMovement,
    LineClearance,
    ResultStatus,
)


class ChangeBatchStatus:
    """Transición de estado del expediente de lote, con registro de historial.

    No valida aquí las reglas de negocio de cada fase (documentos pendientes,
    controles de calidad, etc.) porque esos módulos todavía no existen en el
    sistema — ver plan entregado. Solo aplica la regla ya definida: un lote en
    estado terminal (liberado, rechazado, cerrado, cancelado) no puede cambiar
    de estado sin reabrir explícitamente.
    """

    def execute(self, batch: Batch, new_status: str, actor, reason: str = "", observation: str = "", evidence=None):
        if batch.is_terminal:
            raise BusinessRuleViolation("El lote ya se encuentra en un estado terminal y no puede modificarse.")
        if new_status not in Batch.Status.values:
            raise BusinessRuleViolation("Estado de lote no válido.")

        previous_status = batch.status
        batch.status = new_status
        batch.save(update_fields=("status", "updated_at"))

        BatchStatusHistory.objects.create(
            batch=batch,
            previous_status=previous_status,
            new_status=new_status,
            changed_by=actor,
            reason=reason,
            observation=observation,
            evidence=evidence,
        )
        return batch


class StartBatch:
    def execute(self, batch: Batch, actor):
        if batch.actual_start_at:
            raise BusinessRuleViolation("El lote ya fue iniciado.")
        batch.actual_start_at = timezone.now()
        batch.save(update_fields=("actual_start_at", "updated_at"))
        return ChangeBatchStatus().execute(batch, Batch.Status.PENDING_DISPENSING, actor, reason="Inicio de lote")


class RegisterItemStockMovement:
    """Descuenta/devuelve inventario real de materia prima por bodega y lote.

    Sigue el mismo patrón que apps.inventory.application.use_cases.RegisterInventoryMovement
    (select_for_update + transacción atómica) aplicado a Item/RawMaterialBatch en
    vez de ProductVariant, ya que ese mecanismo central no cubre materias primas."""

    POSITIVE_TYPES = {ItemStockMovement.Type.ENTRY, ItemStockMovement.Type.RETURN, ItemStockMovement.Type.ADJUSTMENT_IN}
    NEGATIVE_TYPES = {ItemStockMovement.Type.EXIT, ItemStockMovement.Type.DISPENSING, ItemStockMovement.Type.LOSS, ItemStockMovement.Type.ADJUSTMENT_OUT}

    @transaction.atomic
    def execute(self, *, item, location, movement_type, quantity, raw_material_batch=None, reason="", reference="", actor=None):
        if quantity <= 0:
            raise BusinessRuleViolation("La cantidad debe ser mayor que cero.")

        stock, _ = ItemStock.objects.select_for_update().get_or_create(
            item=item, location=location, raw_material_batch=raw_material_batch, defaults={"quantity": 0}
        )
        if movement_type in self.POSITIVE_TYPES:
            stock.quantity += quantity
        elif movement_type in self.NEGATIVE_TYPES:
            if stock.available_quantity < quantity:
                raise BusinessRuleViolation("No hay existencia suficiente de la materia prima para esta salida.")
            stock.quantity -= quantity
        else:
            raise BusinessRuleViolation("Tipo de movimiento no soportado.")

        stock.save(update_fields=("quantity", "updated_at"))
        return ItemStockMovement.objects.create(
            item=item,
            location=location,
            raw_material_batch=raw_material_batch,
            movement_type=movement_type,
            quantity=quantity,
            reason=reason,
            reference=reference,
            created_by=actor,
        )


class WeighDispensingLine:
    """Registra el pesaje de una línea de dispensación, validando que la
    materia prima no esté vencida ni rechazada/en cuarentena antes de permitir
    continuar (regla explícita del requerimiento)."""

    def execute(self, line: DispensingLine, *, gross_weight, tare, container, actor):
        batch = line.raw_material_batch
        if batch is not None:
            if batch.is_expired:
                raise BusinessRuleViolation("No se puede dispensar: el lote de materia prima está vencido.")
            if batch.quality_status != batch.QualityStatus.APPROVED:
                raise BusinessRuleViolation(
                    "No se puede dispensar: el lote de materia prima no está aprobado (rechazado o en cuarentena)."
                )

        line.tare = tare
        line.gross_weight = gross_weight
        line.net_weight = gross_weight - tare
        line.container = container
        line.weighed_by = actor
        line.weighed_at = timezone.now()
        line.status = DispensingLine.Status.WEIGHED
        line.save()
        return line


class VerifyDispensingLine:
    def execute(self, line: DispensingLine, *, actor):
        if line.status != DispensingLine.Status.WEIGHED:
            raise BusinessRuleViolation("La línea debe estar pesada antes de poder verificarse.")
        if line.weighed_by_id and actor and line.weighed_by_id == getattr(actor, "id", None):
            raise BusinessRuleViolation("El verificador debe ser distinto de quien realizó la pesada.")
        line.verified_by = actor
        line.verified_at = timezone.now()
        line.status = DispensingLine.Status.VERIFIED
        line.save(update_fields=("verified_by", "verified_at", "status", "updated_at"))
        return line


class CloseDispensingOrder:
    """No permite cerrar la dispensación si existen materias primas pendientes,
    tal como exige el requerimiento. Descuenta inventario real por cada línea
    cerrada usando RegisterItemStockMovement (mecanismo central único)."""

    @transaction.atomic
    def execute(self, order: DispensingOrder, *, location, actor):
        pending = order.lines.exclude(status=DispensingLine.Status.VERIFIED).exclude(status=DispensingLine.Status.CLOSED)
        if pending.exists():
            raise BusinessRuleViolation("No se puede cerrar la dispensación: hay materias primas pendientes de pesar o verificar.")

        for line in order.lines.filter(status=DispensingLine.Status.VERIFIED):
            if line.net_weight:
                RegisterItemStockMovement().execute(
                    item=line.item,
                    location=location,
                    movement_type=ItemStockMovement.Type.DISPENSING,
                    quantity=line.net_weight,
                    raw_material_batch=line.raw_material_batch,
                    reason=f"Dispensación {order.batch}",
                    reference=str(order.id),
                    actor=actor,
                )
            line.status = DispensingLine.Status.CLOSED
            line.save(update_fields=("status", "updated_at"))

        order.status = DispensingOrder.Status.COMPLETED
        order.save(update_fields=("status", "updated_at"))
        ChangeBatchStatus().execute(order.batch, Batch.Status.DISPENSING_DONE, actor, reason="Dispensación completada")
        return order


class ApproveLineClearance:
    """No permite iniciar la fase correspondiente mientras el despeje no esté
    aprobado (regla explícita del requerimiento)."""

    def execute(self, clearance: LineClearance, *, actor, approve: bool):
        pending_criteria = clearance.criteria.filter(result=ResultStatus.NO)
        if approve and pending_criteria.exists():
            raise BusinessRuleViolation("No se puede aprobar el despeje: hay criterios que no cumplen.")
        clearance.status = LineClearance.Status.APPROVED if approve else LineClearance.Status.REJECTED
        clearance.verified_by = actor
        clearance.save(update_fields=("status", "verified_by", "updated_at"))
        return clearance


class ReleaseBatch:
    """Valida las condiciones cruzadas exigidas antes de liberar un lote.
    Cada validación solo se aplica si el registro correspondiente existe (los
    controles son opcionales por ahora hasta que el frontend cubra todas las
    fases) — pero si existe, debe estar en estado conforme."""

    @transaction.atomic
    def execute(self, batch: Batch, *, actor, released_quantity, retained_quantity, rejected_quantity, unit=None, warehouse_location=None, condition, observations=""):
        errors = []

        certificate = getattr(batch, "analysis_certificate", None)
        if certificate is None or certificate.concept != certificate.Concept.APPROVED:
            errors.append("El certificado de análisis debe existir y estar aprobado.")

        microbiology = getattr(batch, "microbiology_analysis", None)
        if microbiology is not None and microbiology.overall_result == microbiology.OverallResult.REJECTED:
            errors.append("El análisis microbiológico está rechazado.")

        weight_control = getattr(batch, "weight_volume_control", None)
        if weight_control is not None and weight_control.overall_result == weight_control.OverallResult.REJECTED:
            errors.append("El control de peso o volumen no es conforme.")

        seal_control = getattr(batch, "seal_integrity_control", None)
        if seal_control is not None and seal_control.overall_result == seal_control.OverallResult.REJECTED:
            errors.append("El control de hermeticidad no es conforme.")

        pending_documents = batch.document_checklist.filter(
            blocks_release=True, applies=True
        ).exclude(status=DocumentChecklistItem.Status.APPROVED)
        if pending_documents.exists():
            errors.append("Hay documentos obligatorios del expediente sin aprobar.")

        rejected_clearances = batch.line_clearances.filter(status=LineClearance.Status.REJECTED)
        if rejected_clearances.exists():
            errors.append("Hay despejes de línea rechazados.")

        if errors:
            raise BusinessRuleViolation(" ".join(errors))

        release, _ = BatchRelease.objects.update_or_create(
            batch=batch,
            defaults={
                "released_quantity": released_quantity,
                "retained_quantity": retained_quantity,
                "rejected_quantity": rejected_quantity,
                "unit": unit,
                "warehouse_location": warehouse_location,
                "released_at": timezone.now(),
                "condition": condition,
                "released_by_quality": actor,
                "observations": observations,
            },
        )
        ChangeBatchStatus().execute(batch, Batch.Status.RELEASED, actor, reason="Lote liberado")
        return release
