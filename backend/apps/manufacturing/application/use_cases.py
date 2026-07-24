import hashlib

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from apps.notifications.infrastructure.models import StaffNotification
from shared.domain.exceptions import BusinessRuleViolation

from ..infrastructure.models import (
    AnalysisCertificate,
    AnalysisTestResult,
    Batch,
    BatchLotMarking,
    BatchRelease,
    BatchStatusHistory,
    CleaningRecord,
    DispensingLine,
    DispensingOrder,
    DocumentChecklistItem,
    ItemStock,
    ItemStockMovement,
    LineClearance,
    ManufacturingStepExecution,
    MicrobiologyAnalysis,
    ProductSpecification,
    ResultStatus,
    Signature,
    WeightVolumeControl,
    WeightVolumeSample,
)

# Campo que representa el "estado del documento" en cada modelo firmable —
# usado por SignDocument para congelar document_status_at_signing y para
# bloquear edición de la firma una vez el documento queda aprobado/cerrado.
# Estados considerados "aprobados" (bloquean nueva firma sin reemplazo explícito).
SIGNABLE_STATUS_FIELD = {
    "rawmaterialidentificationprint": None,
    "manufacturingstepexecution": "status",
    "cleaningrecord": "result",
    "lineidentification": None,
    "productioncontrol": None,
    "fillingcontrol": None,
    "weightvolumecontrol": "overall_result",
    "sealintegritycontrol": "overall_result",
    "packagingcontrol": "label_result",
    "batchlotmarking": "result",
    "analysiscertificate": "concept",
    "microbiologyanalysis": "overall_result",
}
LOCKED_STATUS_VALUES = {"APPROVED", "COMPLETED", "YES"}


class SignDocument:
    """Firma electrónica genérica (dibujada o cargada) para cualquier modelo
    de manufacturing con GenericRelation(Signature). Congela IP, hash de
    integridad del archivo, tipo de firma y el estado del documento en el
    momento de firmar. No permite reemplazar una firma existente del mismo
    rol sin un motivo explícito, y conserva la anterior enlazada vía
    replaced_by para auditoría."""

    @transaction.atomic
    def execute(self, instance, *, actor, image, signature_type, role=Signature.Role.RESPONSIBLE,
                full_name="", role_title="", ip_address=None, observation="", replace_reason=""):
        model_name = instance._meta.model_name
        status_field = SIGNABLE_STATUS_FIELD.get(model_name)
        current_status = getattr(instance, status_field, "") if status_field else ""

        if current_status in LOCKED_STATUS_VALUES:
            raise BusinessRuleViolation(
                "No se puede firmar: el documento ya está aprobado y no admite ediciones."
            )

        existing = instance.signatures.filter(role=role).order_by("-created_at").first()
        if existing and not replace_reason:
            raise BusinessRuleViolation(
                "Ya existe una firma de este rol para el documento. Indica un motivo para reemplazarla."
            )

        image.seek(0)
        digest = hashlib.sha256(image.read()).hexdigest()
        image.seek(0)

        content_type = ContentType.objects.get_for_model(instance)
        signature = Signature.objects.create(
            content_type=content_type,
            object_id=instance.pk,
            image=image,
            owner=actor,
            full_name=full_name,
            role_title=role_title,
            role=role,
            signature_type=signature_type,
            ip_address=ip_address,
            integrity_hash=digest,
            document_status_at_signing=str(current_status),
            observation=observation,
            replaced_reason=replace_reason,
        )

        if existing and replace_reason:
            existing.replaced_by = signature
            existing.save(update_fields=("replaced_by", "updated_at"))

        return signature


def _notify(batch, notification_type, title, message, employee=None):
    StaffNotification.objects.create(
        module="manufacturing",
        batch=batch,
        employee=employee,
        notification_type=notification_type,
        title=title,
        message=message,
    )


class ChangeBatchStatus:
    """Transición de estado del expediente de lote, con registro de historial.

    No valida aquí las reglas de negocio de cada fase (documentos pendientes,
    controles de calidad, etc.) porque esos módulos todavía no existen en el
    sistema — ver plan entregado. Solo aplica la regla ya definida: un lote en
    estado terminal (liberado, rechazado, cerrado, cancelado) no puede cambiar
    de estado sin reabrir explícitamente.
    """

    # Batch.status (GMP, 17 valores) gobierna la UI unificada de producción;
    # ProductionOrder.status (PENDING/IN_PROGRESS/CLOSED/VOIDED) es un detalle
    # interno de inventory que se mantiene sincronizado automáticamente para no
    # exponer dos estados independientes al usuario.
    _ORDER_STATUS_MAP = {
        Batch.Status.DRAFT: "PENDING",
        Batch.Status.SCHEDULED: "PENDING",
        Batch.Status.RELEASED: "CLOSED",
        Batch.Status.CLOSED: "CLOSED",
        Batch.Status.REJECTED: "VOIDED",
        Batch.Status.CANCELLED: "VOIDED",
    }

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

        production_order = batch.production_order
        order_status = self._ORDER_STATUS_MAP.get(new_status, "IN_PROGRESS")
        if production_order.status != order_status:
            production_order.status = order_status
            production_order.save(update_fields=("status", "updated_at"))

        if new_status == Batch.Status.REJECTED:
            _notify(
                batch,
                StaffNotification.NotificationType.BATCH_REJECTED,
                "Lote rechazado",
                f"El lote {batch} fue rechazado. Motivo: {reason or 'no especificado'}.",
                employee=batch.quality_manager,
            )
        return batch


class StartBatch:
    def execute(self, batch: Batch, actor):
        if batch.actual_start_at:
            raise BusinessRuleViolation("El lote ya fue iniciado.")
        batch.actual_start_at = timezone.now()
        batch.save(update_fields=("actual_start_at", "updated_at"))
        return ChangeBatchStatus().execute(batch, Batch.Status.PENDING_DISPENSING, actor, reason="Inicio de lote")


class CreateBatchWithOrder:
    """Punto de entrada único para iniciar un lote: crea la ProductionOrder
    (inventory) y el Batch (manufacturing) en una sola transacción, en vez de
    exigir que el usuario primero cree la orden en Inventario y luego, por
    separado, el lote en Producción. Sustituye el flujo anterior de 2 pantallas."""

    @transaction.atomic
    def execute(
        self,
        *,
        formula,
        planned_quantity,
        actor,
        batch_code: str = "",
        area=None,
        production_line=None,
        production_manager=None,
        quality_manager=None,
        scheduled_at=None,
        notes: str = "",
    ):
        from apps.inventory.infrastructure.models import ProductionOrder

        if planned_quantity <= 0:
            raise BusinessRuleViolation("La cantidad planificada debe ser mayor que cero.")

        production_order = ProductionOrder.objects.create(
            formula=formula,
            output_item=formula.output_item,
            planned_quantity=planned_quantity,
            batch_code=batch_code,
            notes=notes,
        )

        batch = Batch.objects.create(
            production_order=production_order,
            area=area,
            production_line=production_line,
            production_manager=production_manager,
            quality_manager=quality_manager,
            scheduled_at=scheduled_at,
            notes=notes,
            created_by=actor,
        )

        BatchStatusHistory.objects.create(
            batch=batch,
            previous_status="",
            new_status=Batch.Status.DRAFT,
            changed_by=actor,
            reason="Creación del lote",
        )

        return batch


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

        if not line.is_within_tolerance:
            _notify(
                line.order.batch,
                StaffNotification.NotificationType.RAW_MATERIAL_OUT_OF_TOLERANCE,
                "Materia prima fuera de tolerancia",
                f"La pesada de {line.item} se desvía {line.deviation_percentage:.2f}% de lo esperado en el lote {line.order.batch}.",
                employee=line.order.batch.quality_manager,
            )
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


class CompleteManufacturingStep:
    """Completa un paso de fabricación, respetando el orden de la secuencia:
    no permite completar un paso si el paso obligatorio inmediatamente
    anterior sigue pendiente (regla explícita del requerimiento)."""

    def execute(self, execution: ManufacturingStepExecution, *, actor, status, actual_data=None, deviation=""):
        if status == ManufacturingStepExecution.Status.COMPLETED:
            previous_pending = (
                ManufacturingStepExecution.objects.filter(
                    batch=execution.batch,
                    step__sequence__lt=execution.step.sequence,
                    step__is_mandatory=True,
                )
                .exclude(status=ManufacturingStepExecution.Status.COMPLETED)
                .exists()
            )
            if previous_pending:
                raise BusinessRuleViolation(
                    "No se puede completar este paso: hay un paso obligatorio anterior pendiente."
                )

        execution.status = status
        if deviation:
            execution.deviation = deviation
        if actual_data:
            for field, value in actual_data.items():
                setattr(execution, field, value)
        if status == ManufacturingStepExecution.Status.IN_PROGRESS and not execution.started_at:
            execution.started_at = timezone.now()
        if status == ManufacturingStepExecution.Status.COMPLETED:
            execution.finished_at = timezone.now()
            execution.performed_by = execution.performed_by or actor
        execution.save()
        return execution


class RecordWeightVolumeSample:
    """Registra una muestra de peso/volumen. Si la muestra queda fuera de
    especificación, bloquea la continuación del control (overall_result
    pasa a REJECTED) hasta que un responsable autorice explícitamente la
    reanudación — la muestra fuera de rango no debe ser solo informativa."""

    @transaction.atomic
    def execute(self, control: WeightVolumeControl, *, sample_number, gross_weight, tare, volume=None, actor=None):
        if control.overall_result == WeightVolumeControl.OverallResult.REJECTED and not control.resumed_authorized_by:
            raise BusinessRuleViolation(
                "El control de peso/volumen está bloqueado por una muestra fuera de especificación. "
                "Se requiere autorización para reanudar antes de registrar nuevas muestras."
            )

        net_weight = gross_weight - tare if gross_weight is not None and tare is not None else None
        result = ResultStatus.YES
        if net_weight is not None and control.lower_limit is not None and control.upper_limit is not None:
            if net_weight < control.lower_limit or net_weight > control.upper_limit:
                result = ResultStatus.NO

        sample, _ = WeightVolumeSample.objects.update_or_create(
            control=control,
            sample_number=sample_number,
            defaults={
                "gross_weight": gross_weight,
                "tare": tare,
                "volume": volume,
                "result": result,
            },
        )

        if result == ResultStatus.NO:
            control.overall_result = WeightVolumeControl.OverallResult.REJECTED
            control.resumed_authorized_by = None
            control.save(update_fields=("overall_result", "resumed_authorized_by", "updated_at"))
            _notify(
                control.batch,
                StaffNotification.NotificationType.OUT_OF_SPECIFICATION,
                "Peso/volumen fuera de especificación",
                f"La muestra {sample_number} del lote {control.batch} está fuera de especificación. Se bloqueó el control hasta autorizar la reanudación.",
                employee=control.batch.quality_manager,
            )
        return sample


class AuthorizeWeightVolumeResume:
    """Autoriza la reanudación de un control de peso/volumen bloqueado por
    una muestra fuera de especificación."""

    def execute(self, control: WeightVolumeControl, *, actor):
        if control.overall_result != WeightVolumeControl.OverallResult.REJECTED:
            raise BusinessRuleViolation("El control no está bloqueado; no requiere autorización de reanudación.")
        control.resumed_authorized_by = actor
        control.overall_result = WeightVolumeControl.OverallResult.PENDING
        control.save(update_fields=("resumed_authorized_by", "overall_result", "updated_at"))
        return control


class CreateBatchLotMarking:
    """Registra el loteado inicial o final. No permite crear el loteado
    final si el loteado inicial no existe o no fue aprobado (regla explícita
    del requerimiento: "no permitir continuar el acondicionamiento si el
    loteado inicial no está aprobado")."""

    def execute(self, packaging_control, *, stage, actor, **fields):
        if stage == BatchLotMarking.Stage.FINAL:
            initial = packaging_control.lot_markings.filter(stage=BatchLotMarking.Stage.INITIAL).first()
            if initial is None or initial.result != ResultStatus.YES:
                raise BusinessRuleViolation(
                    "No se puede registrar el loteado final: el loteado inicial no existe o no está aprobado."
                )

        marking, _ = BatchLotMarking.objects.update_or_create(
            packaging_control=packaging_control,
            stage=stage,
            defaults=fields,
        )
        return marking


class ApproveLineClearance:
    """No permite iniciar la fase correspondiente mientras el despeje no esté
    aprobado (regla explícita del requerimiento). Tampoco permite aprobar si
    el lote tiene una limpieza de área/equipo vencida o rechazada — la
    vigencia de la limpieza (CleaningRecord.is_expired) debe bloquear el uso
    real, no ser solo informativa."""

    def execute(self, clearance: LineClearance, *, actor, approve: bool):
        pending_criteria = clearance.criteria.filter(result=ResultStatus.NO)
        if approve and pending_criteria.exists():
            raise BusinessRuleViolation("No se puede aprobar el despeje: hay criterios que no cumplen.")

        if approve:
            cleaning_records = clearance.batch.cleaning_records.all()
            expired = [record for record in cleaning_records if record.is_expired]
            if expired:
                raise BusinessRuleViolation(
                    "No se puede aprobar el despeje: hay una limpieza vencida registrada para este lote. Registra una nueva limpieza."
                )
            rejected = cleaning_records.filter(result=CleaningRecord.Result.REJECTED)
            if rejected.exists():
                raise BusinessRuleViolation(
                    "No se puede aprobar el despeje: hay una limpieza de área o equipo rechazada para este lote."
                )

        clearance.status = LineClearance.Status.APPROVED if approve else LineClearance.Status.REJECTED
        clearance.verified_by = actor
        clearance.save(update_fields=("status", "verified_by", "updated_at"))

        if not approve:
            _notify(
                clearance.batch,
                StaffNotification.NotificationType.LINE_CLEARANCE_REJECTED,
                "Despeje de línea no conforme",
                f"El despeje de {clearance.get_phase_display()} del lote {clearance.batch} no fue aprobado.",
                employee=clearance.batch.quality_manager,
            )
        return clearance


class LoadCertificateTestsFromSpecification:
    """Autocompleta los ensayos fisicoquímicos del certificado de análisis desde
    el maestro de especificaciones del producto de la orden, cuando existe.
    No sobreescribe ensayos ya creados manualmente para el certificado."""

    @transaction.atomic
    def execute(self, certificate: AnalysisCertificate):
        output_item = certificate.batch.production_order.output_item
        specification = ProductSpecification.objects.filter(item=output_item, is_active=True).prefetch_related("tests").first()
        if specification is None:
            raise BusinessRuleViolation("Este producto no tiene un maestro de especificaciones registrado.")

        existing_names = set(certificate.tests.values_list("name", flat=True))
        created = []
        for spec_test in specification.tests.filter(category=specification.tests.model.Category.PHYSICOCHEMICAL):
            if spec_test.name in existing_names:
                continue
            created.append(
                AnalysisTestResult(
                    certificate=certificate,
                    name=spec_test.name,
                    unit=spec_test.unit,
                    specification=spec_test.specification_text,
                    lower_limit=spec_test.lower_limit,
                    upper_limit=spec_test.upper_limit,
                    method=spec_test.method,
                    equipment=spec_test.equipment,
                    equipment_parameters=spec_test.equipment_parameters,
                )
            )
        AnalysisTestResult.objects.bulk_create(created)
        return certificate


class LoadMicrobiologySpecificationFromMaster:
    """Autocompleta las especificaciones del análisis microbiológico desde el
    maestro de especificaciones del producto, cuando existe."""

    def execute(self, microbiology: MicrobiologyAnalysis):
        output_item = microbiology.batch.production_order.output_item
        specification = ProductSpecification.objects.filter(item=output_item, is_active=True).prefetch_related("tests").first()
        if specification is None:
            raise BusinessRuleViolation("Este producto no tiene un maestro de especificaciones registrado.")

        microbiological_tests = specification.tests.filter(category=specification.tests.model.Category.MICROBIOLOGICAL)
        microbiology.specifications = [
            {
                "name": test.name,
                "unit": test.unit,
                "specification": test.specification_text,
                "lower_limit": test.lower_limit,
                "upper_limit": test.upper_limit,
                "method": test.method,
            }
            for test in microbiological_tests
        ]
        microbiology.save(update_fields=("specifications", "updated_at"))
        return microbiology


class ReleaseBatch:
    """Valida las condiciones cruzadas exigidas antes de liberar un lote.
    Cada validación solo se aplica si el registro correspondiente existe (los
    controles son opcionales por ahora hasta que el frontend cubra todas las
    fases) — pero si existe, debe estar en estado conforme."""

    @transaction.atomic
    def execute(self, batch: Batch, *, actor, released_quantity, retained_quantity, rejected_quantity, unit=None, warehouse_location=None, condition, observations="", quality_signature=None):
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

        # Rendimiento calculado: si hay control de llenado, debe tener un
        # rendimiento ya calculado (cantidad programada y producida registradas).
        filling_control = getattr(batch, "filling_control", None)
        if filling_control is not None and filling_control.yield_percentage is None:
            errors.append("El rendimiento del control de llenado no ha sido calculado.")

        # Conciliación de materiales: toda diferencia de conciliación distinta
        # de cero debe quedar justificada en observaciones antes de liberar.
        production_control = getattr(batch, "production_control", None)
        if production_control is not None:
            unjustified = [
                material for material in production_control.materials.all()
                if material.reconciliation_difference != 0 and not material.observations
            ]
            if unjustified:
                errors.append("Hay materiales de acondicionamiento con diferencia de conciliación sin justificar.")

        # Loteado aprobado: si hay control de acondicionamiento, el loteado
        # final (cuando exista) debe estar aprobado.
        packaging_control = getattr(batch, "packaging_control", None)
        if packaging_control is not None:
            final_marking = packaging_control.lot_markings.filter(stage=BatchLotMarking.Stage.FINAL).first()
            if final_marking is not None and final_marking.result != ResultStatus.YES:
                errors.append("El loteado final no está aprobado.")

        # Desviaciones cerradas: ningún paso de fabricación puede seguir en
        # estado DEVIATED (desviación abierta) al momento de liberar.
        open_deviations = batch.step_executions.filter(status=ManufacturingStepExecution.Status.DEVIATED)
        if open_deviations.exists():
            errors.append("Hay pasos de fabricación con desviaciones sin cerrar.")

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
                **({"quality_signature": quality_signature} if quality_signature else {}),
            },
        )
        ChangeBatchStatus().execute(batch, Batch.Status.RELEASED, actor, reason="Lote liberado")
        _notify(
            batch,
            StaffNotification.NotificationType.BATCH_RELEASED,
            "Lote liberado",
            f"El lote {batch} fue liberado con condición {release.get_condition_display()}.",
            employee=batch.production_manager,
        )
        return release
