import io
from datetime import timedelta
from decimal import Decimal

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.employees.infrastructure.models import Department, Employee, Position
from apps.inventory.infrastructure.models import (
    Formula,
    FormulaLine,
    Item,
    ItemGroup,
    ItemType,
    Location,
    ProductionOrder,
    Supplier,
    UnitOfMeasure,
    Warehouse,
)
from apps.manufacturing.infrastructure.models import (
    AnalysisCertificate,
    AnalysisTestResult,
    Area,
    Batch,
    BatchLotMarking,
    BatchRelease,
    BatchStatusHistory,
    CleaningRecord,
    DispensingLine,
    DispensingOrder,
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
    ProductionLine,
    ProductSpecification,
    ProductSpecificationTest,
    RawMaterialBatch,
    RawMaterialIdentificationPrint,
    ResultStatus,
    SealIntegrityControl,
    SealIntegritySample,
    WeightVolumeControl,
    WeightVolumeSample,
)

DEMO_PREFIX = "DEMO-MFG"
DEMO_FORMULA_CODE = "DEMO-MFG-FRM-001"


def decimal(value):
    return Decimal(str(value))


def upsert(model, lookup, defaults):
    obj, _ = model.all_objects.update_or_create(
        **lookup,
        defaults={**defaults, "deleted_at": None},
    )
    return obj


# ── Generación de imágenes de prueba (firmas y fotos) ──────────────────────
# Sin estas, todas las secciones con evidencia gráfica (etiqueta testigo,
# loteado, firmas electrónicas) quedarían siempre en su variante "vacía" y no
# se podría probar el layout real de esos bloques en el PDF.

def _signature_png(seed_text):
    from PIL import Image, ImageDraw

    img = Image.new("RGBA", (300, 100), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    offset = sum(ord(ch) for ch in seed_text) % 20
    points = [(20, 70 - offset % 15), (80, 20 + offset % 10), (140, 80 - offset % 12), (200, 30 + offset % 8), (260, 70)]
    draw.line(points, fill=(20, 40, 90, 255), width=6)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _photo_jpg(label):
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (640, 420), (235, 236, 238))
    draw = ImageDraw.Draw(img)
    draw.rectangle([8, 8, 631, 411], outline=(140, 140, 140), width=3)
    draw.text((24, 24), label, fill=(50, 55, 60))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _attach_signature(field, filename, seed_text):
    if not field:
        field.save(filename, ContentFile(_signature_png(seed_text)), save=True)


def _attach_photo(field, filename, label):
    if not field:
        field.save(filename, ContentFile(_photo_jpg(label)), save=True)


# ── Maestros compartidos entre todos los lotes demo ────────────────────────

def ensure_employee():
    department = upsert(
        Department,
        {"name": "Produccion"},
        {"description": "Equipo de produccion y calidad.", "is_active": True},
    )
    position = upsert(
        Position,
        {"department": department, "name": "Operario lider de produccion"},
        {"description": "Responsable demo del lote de produccion.", "is_active": True},
    )
    employee = upsert(
        Employee,
        {"employee_code": "DEMO-MFG-EMP-001"},
        {
            "document_number": "DEMO-MFG-DOC-001",
            "first_name": "Teo",
            "last_name": "Produccion Demo",
            "email": "teo.produccion.demo@example.com",
            "department": department,
            "position": position,
            "hire_date": timezone.localdate() - timedelta(days=365),
            "status": Employee.Status.ACTIVE,
        },
    )
    quality_employee = upsert(
        Employee,
        {"employee_code": "DEMO-MFG-EMP-002"},
        {
            "document_number": "DEMO-MFG-DOC-002",
            "first_name": "Ana",
            "last_name": "Calidad Demo",
            "email": "ana.calidad.demo@example.com",
            "department": department,
            "position": position,
            "hire_date": timezone.localdate() - timedelta(days=300),
            "status": Employee.Status.ACTIVE,
        },
    )
    return employee, quality_employee


def ensure_inventory_master():
    unit_kg = upsert(UnitOfMeasure, {"code": "KG"}, {"name": "Kilogramo", "abbreviation": "kg"})
    unit_un = upsert(UnitOfMeasure, {"code": "UN"}, {"name": "Unidad", "abbreviation": "und"})

    finished_type = upsert(
        ItemType,
        {"name": "Producto terminado"},
        {"description": "Productos terminados para venta.", "is_inventoried": True},
    )
    raw_type = upsert(
        ItemType,
        {"name": "Materia prima"},
        {"description": "Insumos usados en fabricacion.", "is_inventoried": True},
    )
    packaging_type = upsert(
        ItemType,
        {"name": "Material de empaque"},
        {"description": "Materiales de acondicionamiento.", "is_inventoried": True},
    )

    finished_group = upsert(
        ItemGroup,
        {"code": "DEMO-PT"},
        {"name": "Demo producto terminado", "is_inventoried": True},
    )
    raw_group = upsert(
        ItemGroup,
        {"code": "DEMO-MP"},
        {"name": "Demo materias primas", "is_inventoried": True},
    )
    packaging_group = upsert(
        ItemGroup,
        {"code": "DEMO-ME"},
        {"name": "Demo material de empaque", "is_inventoried": True},
    )

    supplier = upsert(
        Supplier,
        {"nit": "DEMO-MFG-SUP-001"},
        {
            "name": "Proveedor Demo Materias Primas",
            "contact_name": "Calidad Demo",
            "phone": "3000000000",
            "email": "proveedor.demo@example.com",
            "city": "Barranquilla",
            "address": "Direccion demo",
            "is_active": True,
        },
    )

    warehouse = upsert(
        Warehouse,
        {"code": "DEMO-MFG-BOD"},
        {"name": "Bodega demo produccion", "address": "Area demo", "is_active": True},
    )
    location = upsert(
        Location,
        {"warehouse": warehouse, "code": "MP-DEMO"},
        {"name": "Materias primas demo", "is_active": True},
    )

    output_item = upsert(
        Item,
        {"code": "DEMO-MFG-PT-GEL-500"},
        {
            "name": "Gel antibacterial DEMO 500 mL",
            "item_type": finished_type,
            "item_group": finished_group,
            "unit": unit_un,
            "supplier": None,
            "cost": decimal("4200"),
            "tax_rate": decimal("0"),
            "minimum_quantity": decimal("10"),
            "maximum_quantity": decimal("500"),
            "description": "Producto terminado de prueba para expediente completo de produccion.",
            "tracks_inventory": True,
            "tracks_batches": True,
            "is_active": True,
        },
    )

    raw_items = [
        ("DEMO-MFG-MP-ALC", "Alcohol etilico 70%", decimal("35.000")),
        ("DEMO-MFG-MP-AGU", "Agua purificada", decimal("12.000")),
        ("DEMO-MFG-MP-GLI", "Glicerina USP", decimal("2.000")),
        ("DEMO-MFG-MP-CAR", "Carbopol 940", decimal("0.350")),
    ]
    raw_materials = []
    for code, name, formula_quantity in raw_items:
        item = upsert(
            Item,
            {"code": code},
            {
                "name": name,
                "item_type": raw_type,
                "item_group": raw_group,
                "unit": unit_kg,
                "supplier": supplier,
                "cost": decimal("0"),
                "tax_rate": decimal("0"),
                "minimum_quantity": decimal("1"),
                "maximum_quantity": decimal("1000"),
                "description": "Materia prima demo para lote completo de prueba.",
                "tracks_inventory": True,
                "tracks_batches": True,
                "is_active": True,
            },
        )
        raw_materials.append((item, formula_quantity))

    packaging_materials = []
    for code, name, quantity in [
        ("DEMO-MFG-ME-ENV-500", "Envase PET DEMO 500 mL", decimal("100")),
        ("DEMO-MFG-ME-ETQ-500", "Etiqueta DEMO gel antibacterial 500 mL", decimal("100")),
    ]:
        item = upsert(
            Item,
            {"code": code},
            {
                "name": name,
                "item_type": packaging_type,
                "item_group": packaging_group,
                "unit": unit_un,
                "supplier": supplier,
                "cost": decimal("0"),
                "tax_rate": decimal("0"),
                "minimum_quantity": decimal("10"),
                "maximum_quantity": decimal("1000"),
                "description": "Material de empaque demo para lote completo de prueba.",
                "tracks_inventory": True,
                "tracks_batches": False,
                "is_active": True,
            },
        )
        packaging_materials.append((item, quantity))

    return output_item, raw_materials, packaging_materials, unit_un, location, supplier


def ensure_raw_batches(raw_materials, location, supplier):
    today = timezone.localdate()
    result = []
    for item, formula_quantity in raw_materials:
        batch = upsert(
            RawMaterialBatch,
            {"item": item, "supplier_batch_code": f"{item.code}-LOTE-001"},
            {
                "received_at": today - timedelta(days=20),
                "expires_at": today + timedelta(days=365),
                "analysis_number": f"AN-{item.code[-3:]}-001",
                "quality_status": RawMaterialBatch.QualityStatus.APPROVED,
                "supplier": supplier,
                "notes": "Lote de materia prima demo aprobado para pruebas.",
            },
        )
        stock = upsert(
            ItemStock,
            {"item": item, "location": location, "raw_material_batch": batch},
            {"quantity": formula_quantity * decimal("20"), "reserved_quantity": decimal("0")},
        )
        ItemStockMovement.objects.get_or_create(
            item=item,
            location=location,
            raw_material_batch=batch,
            movement_type=ItemStockMovement.Type.ENTRY,
            reference=f"{DEMO_PREFIX}-ENTRADA-{item.code}",
            defaults={
                "quantity": stock.quantity,
                "reason": "Entrada demo de materia prima para lote de prueba.",
            },
        )
        result.append((item, formula_quantity, batch))
    return result


def ensure_formula(output_item, raw_materials, unit_un):
    formula = upsert(
        Formula,
        {"code": DEMO_FORMULA_CODE},
        {
            "name": "Formula demo gel antibacterial 500 mL x 100 unidades",
            "output_item": output_item,
            "yield_quantity": decimal("100"),
            "yield_unit": unit_un,
            "is_active": True,
        },
    )
    for item, quantity in raw_materials:
        line = formula.lines.filter(item=item).first()
        if line is None:
            FormulaLine.objects.create(formula=formula, item=item, quantity=quantity)
        else:
            line.quantity = quantity
            line.save(update_fields=("quantity", "updated_at"))

    steps = [
        ("Dispersion", "Sanitizar tanque y cargar agua purificada. Iniciar agitacion moderada."),
        ("Gelificacion", "Adicionar carbopol lentamente hasta lograr dispersion uniforme."),
        ("Mezcla", "Incorporar glicerina y alcohol etilico controlando temperatura ambiente."),
        ("Homogeneizacion", "Mezclar hasta obtener gel homogeneo y liberar a llenado."),
    ]
    for sequence, (phase, instruction) in enumerate(steps, start=1):
        upsert(
            ManufacturingStep,
            {"formula": formula, "sequence": sequence},
            {
                "phase": phase,
                "instruction": instruction,
                "required_equipment": "Tanque mezclador DEMO",
                "target_temperature": decimal("25.00"),
                "target_time_minutes": 30 if sequence in (1, 4) else 20,
                "target_agitation_speed": "Media",
                "target_ph": decimal("6.50") if sequence == 4 else None,
                "is_mandatory": True,
            },
        )
    return formula


# ── Escenario: construcción parametrizada de un lote ───────────────────────
# Cada lote demo se identifica por su propio batch_code (DEMO-MFG-LOTE-00N) y
# recibe cuánto avance debe tener (`stage`), para poder cubrir todo el rango
# de estados de Batch y no solo el caso "liberado y perfecto".

class Stage:
    DRAFT = "draft"                    # Solo información general, nada diligenciado.
    IN_PROCESS = "in_process"          # Dispensación + fabricación hechas; resto pendiente.
    DEVIATION = "deviation"            # Llega a calidad con hermeticidad y peso fuera de especificación.
    REJECTED = "rejected"              # Certificado de análisis rechazado, lote rechazado.
    PENDING_DOCS = "pending_docs"      # Todo el proceso físico hecho, checklist documental incompleto.
    COMPLETE = "complete"              # Expediente completo y liberado, con fotos/firmas reales.


def ensure_batch(code, formula, output_item, unit_un, location, employee, *, status, notes, planned=100, actual=98):
    today = timezone.localdate()
    area = upsert(Area, {"code": "DEMO-MFG-AREA"}, {"name": "Area demo produccion", "is_active": True})
    line = upsert(
        ProductionLine,
        {"code": "DEMO-MFG-LINEA"},
        {"name": "Linea demo de fabricacion", "area": area, "is_active": True},
    )

    order_status_map = {
        Batch.Status.DRAFT: ProductionOrder.Status.PENDING,
        Batch.Status.MANUFACTURING: ProductionOrder.Status.IN_PROGRESS,
        Batch.Status.PENDING_DOCUMENTS: ProductionOrder.Status.IN_PROGRESS,
        Batch.Status.REJECTED: ProductionOrder.Status.CLOSED,
        Batch.Status.RELEASED: ProductionOrder.Status.CLOSED,
    }
    order_status = order_status_map.get(status, ProductionOrder.Status.IN_PROGRESS)

    production_order = ProductionOrder.objects.filter(batch_code=code).first()
    order_fields = {
        "formula": formula,
        "output_item": output_item,
        "planned_quantity": decimal(planned),
        "actual_quantity": decimal(actual),
        "batch_code": code,
        "started_at": today - timedelta(days=2),
        "closed_at": today if status in Batch.TERMINAL_STATUSES else None,
        "responsible": "Teo Produccion Demo",
        "is_dispensed": status != Batch.Status.DRAFT,
        "is_output_received": status in Batch.TERMINAL_STATUSES,
        "status": order_status,
        "notes": f"Orden demo ({code}) creada por seed_manufacturing_demo.",
    }
    if production_order is None:
        production_order = ProductionOrder.objects.create(**order_fields)
    else:
        for field, value in order_fields.items():
            setattr(production_order, field, value)
        production_order.save()

    batch = upsert(
        Batch,
        {"production_order": production_order},
        {
            "status": status,
            "area": area,
            "production_line": line,
            "production_manager": employee,
            "quality_manager": employee,
            "scheduled_at": today - timedelta(days=3),
            "actual_start_at": timezone.now() - timedelta(days=2, hours=3) if status != Batch.Status.DRAFT else None,
            "actual_end_at": timezone.now() - timedelta(hours=2) if status in Batch.TERMINAL_STATUSES else None,
            "notes": notes,
            "created_by": None,
        },
    )

    BatchStatusHistory.objects.get_or_create(
        batch=batch,
        previous_status="",
        new_status=status,
        reason=f"Seed demo {code}",
        defaults={"changed_by": None, "observation": f"Lote demo precargado en estado {status}."},
    )
    return batch, area, line


def ensure_dispensing(batch, raw_batches, employee, *, with_signatures=False):
    order = upsert(
        DispensingOrder,
        {"batch": batch},
        {
            "status": DispensingOrder.Status.COMPLETED,
            "issued_at": timezone.localdate() - timedelta(days=2),
            "responsible": employee,
            "verifier": employee,
        },
    )
    order.lines.all().delete()
    for sequence, (item, quantity, raw_batch) in enumerate(raw_batches, start=1):
        line = DispensingLine.objects.create(
            order=order,
            sequence=sequence,
            formula_line=batch.production_order.formula.lines.filter(item=item).first(),
            item=item,
            raw_material_batch=raw_batch,
            theoretical_quantity=quantity,
            tolerance_percentage=decimal("2.00"),
            tare=decimal("0.150"),
            gross_weight=quantity + decimal("0.150"),
            net_weight=quantity,
            container=f"Contenedor demo {sequence}",
            status=DispensingLine.Status.CLOSED,
            weighed_by=employee,
            weighed_at=timezone.now() - timedelta(days=2, hours=2),
            verified_by=employee,
            verified_at=timezone.now() - timedelta(days=2, hours=1),
            observations="Materia prima pesada y verificada en demo.",
        )
        RawMaterialIdentificationPrint.objects.get_or_create(
            dispensing_line=line,
            is_reprint=False,
            defaults={"printed_by": None, "reprint_reason": ""},
        )
    if with_signatures:
        _attach_signature(order.responsible_signature, "resp_sign.png", f"{batch.id}-resp")
        _attach_signature(order.verifier_signature, "verif_sign.png", f"{batch.id}-verif")
    return order


def ensure_early_process(batch, employee, area, line):
    """Despeje y limpieza de dispensación/fabricación + pasos de fabricación
    completados. Usado por los escenarios que no llegan hasta calidad/empaque."""
    now = timezone.now()

    for phase in (LineClearance.Phase.DISPENSING, LineClearance.Phase.MANUFACTURING):
        clearance = upsert(
            LineClearance,
            {"batch": batch, "phase": phase},
            {
                "area": area,
                "production_line": line,
                "cleared_at": now - timedelta(days=2),
                "previous_product": "Sin producto anterior - demo",
                "previous_batch_code": "N/A",
                "status": LineClearance.Status.APPROVED,
                "performed_by": employee,
                "verified_by": employee,
            },
        )
        for criterion, _label in LineClearanceCriterion.CRITERIA_CHOICES:
            upsert(
                LineClearanceCriterion,
                {"clearance": clearance, "criterion": criterion},
                {"result": ResultStatus.YES, "observation": "Cumple en demo."},
            )

    upsert(
        CleaningRecord,
        {"batch": batch, "record_type": CleaningRecord.Type.EQUIPMENT, "equipment_code": "DEMO-TQ-001"},
        {
            "phase": LineClearance.Phase.MANUFACTURING,
            "area": area.name,
            "equipment": "Tanque mezclador DEMO",
            "cleaned_at": now - timedelta(days=2, hours=4),
            "previous_product": "Sin producto anterior - demo",
            "previous_batch_code": "N/A",
            "cleaning_method": "Limpieza y sanitizacion segun procedimiento demo.",
            "sanitizer": "Alcohol 70%",
            "sanitizer_concentration": "70%",
            "sanitizer_batch": "SAN-DEMO-001",
            "sanitizer_expires_at": timezone.localdate() + timedelta(days=180),
            "performed_by": employee,
            "verified_by": employee,
            "result": CleaningRecord.Result.APPROVED,
            "observations": "Equipo apto para iniciar fabricacion demo.",
            "valid_until": now + timedelta(days=7),
        },
    )

    upsert(
        LineIdentification,
        {"batch": batch},
        {
            "area": area,
            "production_line": line,
            "placed_at": now - timedelta(days=2),
            "placed_by": employee,
            "removed_at": None,
            "removed_by": None,
        },
    )

    ManufacturingStepExecution.objects.filter(batch=batch).delete()
    for step in batch.production_order.formula.manufacturing_steps.all():
        ManufacturingStepExecution.objects.create(
            batch=batch,
            step=step,
            status=ManufacturingStepExecution.Status.COMPLETED,
            actual_quantity=decimal("98") if step.sequence == 4 else None,
            actual_temperature=decimal("25.00"),
            actual_time_minutes=step.target_time_minutes,
            actual_agitation_speed="Media",
            actual_ph=decimal("6.50") if step.sequence == 4 else None,
            started_at=now - timedelta(days=2, hours=4 - step.sequence),
            finished_at=now - timedelta(days=2, hours=3 - step.sequence),
            performed_by=employee,
            verified_by=employee,
            observations="Paso demo ejecutado conforme.",
        )


def ensure_process_controls(
    batch, packaging_materials, unit_un, employee, area, line, *,
    seal_result=None, weight_result=None, packaging_photos=False,
):
    """Fases de llenado/acondicionamiento en adelante: control de producción,
    llenado, peso/volumen, hermeticidad y acondicionamiento. Los parámetros
    seal_result/weight_result permiten forzar una desviación real (fuga,
    fuera de tolerancia) para probar esa variante del PDF."""
    now = timezone.now()
    today = timezone.localdate()

    for phase in (LineClearance.Phase.FILLING, LineClearance.Phase.PACKAGING):
        clearance = upsert(
            LineClearance,
            {"batch": batch, "phase": phase},
            {
                "area": area,
                "production_line": line,
                "cleared_at": now - timedelta(days=1, hours=6),
                "previous_product": "Sin producto anterior - demo",
                "previous_batch_code": "N/A",
                "status": LineClearance.Status.APPROVED,
                "performed_by": employee,
                "verified_by": employee,
            },
        )
        for criterion, _label in LineClearanceCriterion.CRITERIA_CHOICES:
            upsert(
                LineClearanceCriterion,
                {"clearance": clearance, "criterion": criterion},
                {"result": ResultStatus.YES, "observation": "Cumple en demo."},
            )

    upsert(
        CleaningRecord,
        {"batch": batch, "record_type": CleaningRecord.Type.EQUIPMENT, "equipment_code": "DEMO-LLEN-001"},
        {
            "phase": LineClearance.Phase.FILLING,
            "area": area.name,
            "equipment": "Llenadora DEMO",
            "cleaned_at": now - timedelta(days=1, hours=6),
            "previous_product": "Sin producto anterior - demo",
            "previous_batch_code": "N/A",
            "cleaning_method": "Limpieza y sanitizacion segun procedimiento demo.",
            "sanitizer": "Hipoclorito de sodio 0,5%",
            "sanitizer_concentration": "0.5%",
            "sanitizer_batch": "SAN-DEMO-002",
            "sanitizer_expires_at": today + timedelta(days=180),
            "performed_by": employee,
            "verified_by": employee,
            "result": CleaningRecord.Result.APPROVED,
            "observations": "Equipo apto para llenado demo.",
            "valid_until": now + timedelta(days=7),
        },
    )

    production_control = upsert(
        ProductionControl,
        {"batch": batch},
        {"lot_size": decimal("100"), "unit": unit_un, "notes": "Control demo de materiales."},
    )
    production_control.materials.all().delete()
    for item, quantity in packaging_materials:
        ProductionControlMaterial.objects.create(
            control=production_control,
            item=item,
            requested_quantity=quantity,
            delivered_quantity=quantity,
            delivered_by=employee,
            received_by=employee,
            delivered_at=now - timedelta(days=1, hours=4),
            returned_quantity=decimal("2") if "ENV" in item.code else decimal("0"),
            return_received_by=employee,
            return_reason="Sobrante demo." if "ENV" in item.code else "",
            good_units=decimal("98"),
            process_rejects=decimal("0"),
            factory_rejects=decimal("0"),
            observations="Conciliacion demo cerrada.",
        )

    filling = upsert(
        FillingControl,
        {"batch": batch},
        {
            "production_line": line,
            "equipment": "Llenadora DEMO",
            "source_tank": "Tanque DEMO 001",
            "started_at": now - timedelta(days=1, hours=5),
            "finished_at": now - timedelta(days=1, hours=2),
            "responsible": employee,
            "verifier": employee,
            "planned_quantity": decimal("100"),
            "produced_quantity": decimal("98"),
            "rejected_quantity": decimal("2"),
            "recovered_quantity": decimal("0"),
            "justification": "Merma tecnica demo durante ajuste de llenado.",
            "observations": "Llenado demo finalizado.",
        },
    )
    filling.participants.all().delete()
    FillingParticipant.objects.create(
        control=filling,
        employee=employee,
        role="Operario demo",
        activity="Llenado y verificacion visual",
        check_in=now - timedelta(days=1, hours=5),
        check_out=now - timedelta(days=1, hours=2),
    )
    filling.log_entries.all().delete()
    FillingLogEntry.objects.create(
        control=filling,
        recorded_at=now - timedelta(days=1, hours=3),
        units_produced=decimal("98"),
        displays=decimal("10"),
        boxes=decimal("2"),
        units_rejected=decimal("2"),
        rejection_reason="Ajuste inicial demo",
        performed_by=employee,
        verified_by=employee,
        observations="Registro demo de llenado.",
    )

    weight_deviation = weight_result == "OUT_OF_SPEC"
    weight = upsert(
        WeightVolumeControl,
        {"batch": batch},
        {
            "tare": decimal("0.020"),
            "lower_limit": decimal("0.480"),
            "upper_limit": decimal("0.520"),
            "unit": unit_un,
            "performed_by": employee,
            "verified_by": employee,
            "overall_result": WeightVolumeControl.OverallResult.REJECTED if weight_deviation else WeightVolumeControl.OverallResult.APPROVED,
        },
    )
    weight.samples.all().delete()
    gross_values = ["0.560", "0.518", "0.521"] if weight_deviation else ["0.520", "0.518", "0.521"]
    for sample_number, gross in enumerate(gross_values, start=1):
        out_of_spec = weight_deviation and sample_number == 1
        WeightVolumeSample.objects.create(
            control=weight,
            sample_number=sample_number,
            sampled_at=now - timedelta(days=1, hours=2),
            gross_weight=decimal(gross),
            tare=decimal("0.020"),
            volume=decimal("500"),
            result=ResultStatus.NO if out_of_spec else ResultStatus.YES,
            observation="Muestra demo fuera de especificacion, se ajusta llenadora." if out_of_spec else "Muestra demo conforme.",
        )

    seal_deviation = seal_result == "LEAK"
    seal = upsert(
        SealIntegrityControl,
        {"batch": batch},
        {
            "tested_at": now - timedelta(days=1, hours=1),
            "equipment": "Camara de vacio DEMO",
            "equipment_code": "DEMO-CV-001",
            "pressure_bar": decimal("0.600"),
            "time_seconds": 60,
            "performed_by": employee,
            "verified_by": employee,
            "observations": "Se detecta fuga en muestra demo, requiere reinspeccion." if seal_deviation else "Sin fugas en muestras demo.",
            "overall_result": SealIntegrityControl.OverallResult.REJECTED if seal_deviation else SealIntegrityControl.OverallResult.APPROVED,
        },
    )
    seal.samples.all().delete()
    for sample_number in range(1, 4):
        is_leak = seal_deviation and sample_number == 2
        SealIntegritySample.objects.create(
            control=seal,
            sample_number=sample_number,
            result=SealIntegritySample.Result.LEAK if is_leak else SealIntegritySample.Result.CONFORMING,
            observation="Fuga detectada en sellado demo." if is_leak else "Conforme demo.",
        )

    packaging = upsert(
        PackagingControl,
        {"batch": batch},
        {
            "responsible": employee,
            "verifier": employee,
            "label_code": "ETQ-DEMO-GEL-500",
            "artwork_version": "v1-demo",
            "label_material_batch": "ETQ-DEMO-LOTE-001",
            "label_result": ResultStatus.YES,
            "label_observations": "Etiqueta testigo demo conforme.",
            "label_performed_by": employee,
            "label_verified_by": employee,
            "units_per_display": 10,
            "displays_per_box": 5,
            "units_per_box": 50,
            "complete_boxes": 1,
            "incomplete_displays": 4,
            "loose_units": 8,
            "total_reconciled": decimal("98"),
            "balances": decimal("2"),
            "rejections": decimal("0"),
            "rejection_reasons": "",
        },
    )
    if packaging_photos:
        _attach_photo(packaging.label_sample_file, "label_demo.jpg", "ETIQUETA TESTIGO DEMO")

    packaging.lot_markings.all().delete()
    for stage in (BatchLotMarking.Stage.INITIAL, BatchLotMarking.Stage.FINAL):
        marking = BatchLotMarking.objects.create(
            packaging_control=packaging,
            stage=stage,
            printed_batch_code=batch.production_order.batch_code,
            manufacture_date=today - timedelta(days=2),
            expiry_date=today + timedelta(days=730),
            printed_at=now - timedelta(hours=5 if stage == BatchLotMarking.Stage.INITIAL else 1),
            is_legible=True,
            is_correctly_placed=True,
            result=ResultStatus.YES,
            performed_by=employee,
            verified_by=employee,
        )
        if packaging_photos:
            _attach_photo(marking.photo, f"loteado_{stage}.jpg", f"LOTEADO {stage}")

    return production_control, filling, weight, seal, packaging


def ensure_quality(batch, output_item, unit_un, location, employee, *, concept=AnalysisCertificate.Concept.APPROVED):
    today = timezone.localdate()
    spec = upsert(
        ProductSpecification,
        {"item": output_item},
        {
            "version": "1.0-demo",
            "effective_date": today - timedelta(days=30),
            "is_active": True,
            "notes": "Especificacion demo para lote completo de prueba.",
        },
    )
    spec.tests.all().delete()
    spec_tests = [
        ("PHYSICOCHEMICAL", 1, "Aspecto", "", "Gel translucido caracteristico", "", "", "Visual"),
        ("PHYSICOCHEMICAL", 2, "pH", "", "6.0 - 7.0", "6.0", "7.0", "Potenciometrico"),
        ("MICROBIOLOGICAL", 1, "Recuento aerobios mesofilos", "UFC/g", "< 100", "", "100", "Microbiologia"),
    ]
    for category, sequence, name, unit, text, lower, upper, method in spec_tests:
        ProductSpecificationTest.objects.create(
            specification=spec,
            category=category,
            sequence=sequence,
            name=name,
            unit=unit,
            specification_text=text,
            lower_limit=lower,
            upper_limit=upper,
            method=method,
            equipment="Equipo demo",
            is_mandatory=True,
        )

    is_rejected = concept == AnalysisCertificate.Concept.REJECTED
    certificate = upsert(
        AnalysisCertificate,
        {"batch": batch},
        {
            "manufactured_at": today - timedelta(days=2),
            "sampled_at": today - timedelta(days=1),
            "analyzed_at": today,
            "analyzed_by": employee,
            "verified_by": employee,
            "concept": concept,
            "observations": "Producto no cumple pH especificado, se rechaza el lote." if is_rejected else "Resultados demo conformes.",
        },
    )
    certificate.tests.all().delete()
    for test in spec.tests.all():
        failing = is_rejected and test.name == "pH"
        AnalysisTestResult.objects.create(
            certificate=certificate,
            name=test.name,
            result_type="No conforme" if failing else "Conforme",
            unit=test.unit,
            specification=test.specification_text,
            lower_limit=test.lower_limit,
            upper_limit=test.upper_limit,
            method=test.method,
            equipment=test.equipment,
            bulk_result="8.2" if failing else ("Conforme" if test.name != "pH" else "6.5"),
            finished_product_result="8.2" if failing else ("Conforme" if test.name != "pH" else "6.5"),
            complies=not failing,
            observations="Resultado demo fuera de especificacion." if failing else "Resultado demo dentro de especificacion.",
            performed_by=employee,
            verified_by=employee,
        )

    upsert(
        MicrobiologyAnalysis,
        {"batch": batch},
        {
            "sample_code": f"{batch.production_order.batch_code}-MIC",
            "sample_type": "Producto terminado",
            "taken_at": today - timedelta(days=1),
            "taken_by": employee,
            "sent_at": today - timedelta(days=1),
            "laboratory": "Laboratorio demo",
            "report_number": f"MIC-{batch.production_order.batch_code[-3:]}",
            "results": [{"name": "Aerobios mesofilos", "value": "< 10 UFC/g"}],
            "specifications": [{"ensayo": "Aerobios mesofilos", "especificacion": "< 100 UFC/g"}],
            "overall_result": MicrobiologyAnalysis.OverallResult.REJECTED if is_rejected else MicrobiologyAnalysis.OverallResult.APPROVED,
            "approved_at": today,
            "approved_by": employee,
            "observations": "Analisis microbiologico demo aprobado." if not is_rejected else "Pendiente de reanalisis.",
        },
    )
    return certificate


def ensure_document_checklist(batch, employee, *, complete=True):
    now = timezone.now()
    for index, (code, name) in enumerate(DocumentChecklistItem.DocumentCode.choices):
        if complete:
            status = DocumentChecklistItem.Status.APPROVED
            result = ResultStatus.YES
            verified_at = now - timedelta(hours=1)
            observations = "Documento demo aprobado."
        else:
            # Dos documentos quedan pendientes/rechazados a propósito para
            # poder ver esa variante en el checklist y en el PDF.
            if index == 0:
                status, result, verified_at, observations = (
                    DocumentChecklistItem.Status.REJECTED, ResultStatus.NO, now - timedelta(hours=1),
                    "Documento demo rechazado, requiere correccion.",
                )
            elif index == 1:
                status, result, verified_at, observations = (
                    DocumentChecklistItem.Status.PENDING, ResultStatus.NOT_APPLICABLE, None, "",
                )
            else:
                status, result, verified_at, observations = (
                    DocumentChecklistItem.Status.APPROVED, ResultStatus.YES, now - timedelta(hours=1),
                    "Documento demo aprobado.",
                )
        upsert(
            DocumentChecklistItem,
            {"batch": batch, "document_code": code},
            {
                "name": name,
                "format_code": f"DEMO-{code[:8]}",
                "format_version": "1.0",
                "applies": True,
                "result": result,
                "status": status,
                "responsible": employee,
                "verifier": employee,
                "filled_at": now - timedelta(hours=2),
                "verified_at": verified_at,
                "observations": observations,
                "blocks_release": not complete,
            },
        )


def ensure_release(batch, unit_un, location, employee, *, condition=BatchRelease.Condition.RELEASED):
    upsert(
        BatchRelease,
        {"batch": batch},
        {
            "released_quantity": decimal("98") if condition == BatchRelease.Condition.RELEASED else decimal("0"),
            "retained_quantity": decimal("1"),
            "rejected_quantity": decimal("1") if condition == BatchRelease.Condition.RELEASED else decimal("99"),
            "unit": unit_un,
            "warehouse_location": location,
            "released_at": timezone.now(),
            "condition": condition,
            "released_by_quality": employee,
            "approved_by_technical_director": employee,
            "observations": "Lote demo liberado para pruebas funcionales." if condition == BatchRelease.Condition.RELEASED
            else "Lote demo rechazado: no cumple especificacion de pH.",
        },
    )


# ── Orquestación de cada escenario ──────────────────────────────────────────

def build_scenario(code, stage, formula, master, employee, quality_employee, raw_batches):
    output_item, _raw_materials, packaging_materials, unit_un, location, _supplier = master

    notes_by_stage = {
        Stage.DRAFT: "Lote demo recien creado, aun sin diligenciar (borrador).",
        Stage.IN_PROCESS: "Lote demo a medio proceso: dispensacion y fabricacion completas, resto pendiente.",
        Stage.DEVIATION: "Lote demo con desviaciones reales en hermeticidad y peso, pendiente de revision de calidad.",
        Stage.REJECTED: "Lote demo rechazado por no conformidad en certificado de analisis.",
        Stage.PENDING_DOCS: "Lote demo con proceso fisico completo pero checklist documental incompleto.",
        Stage.COMPLETE: "Lote demo completo para probar expediente, controles y PDF (con fotos y firmas reales).",
    }
    status_by_stage = {
        Stage.DRAFT: Batch.Status.DRAFT,
        Stage.IN_PROCESS: Batch.Status.MANUFACTURING,
        Stage.DEVIATION: Batch.Status.PENDING_DOCUMENTS,
        Stage.REJECTED: Batch.Status.REJECTED,
        Stage.PENDING_DOCS: Batch.Status.PENDING_DOCUMENTS,
        Stage.COMPLETE: Batch.Status.RELEASED,
    }

    batch, area, line = ensure_batch(
        code, formula, output_item, unit_un, location, employee,
        status=status_by_stage[stage], notes=notes_by_stage[stage],
    )

    if stage == Stage.DRAFT:
        return batch

    ensure_dispensing(batch, raw_batches, employee, with_signatures=(stage == Stage.COMPLETE))
    ensure_early_process(batch, employee, area, line)

    if stage == Stage.IN_PROCESS:
        return batch

    seal_result = "LEAK" if stage == Stage.DEVIATION else None
    weight_result = "OUT_OF_SPEC" if stage == Stage.DEVIATION else None
    ensure_process_controls(
        batch, packaging_materials, unit_un, employee, area, line,
        seal_result=seal_result, weight_result=weight_result,
        packaging_photos=(stage == Stage.COMPLETE),
    )

    concept = AnalysisCertificate.Concept.REJECTED if stage == Stage.REJECTED else AnalysisCertificate.Concept.APPROVED
    ensure_quality(batch, output_item, unit_un, location, quality_employee, concept=concept)

    if stage == Stage.DEVIATION:
        return batch

    ensure_document_checklist(batch, employee, complete=(stage != Stage.PENDING_DOCS))

    if stage == Stage.PENDING_DOCS:
        return batch

    condition = BatchRelease.Condition.REJECTED if stage == Stage.REJECTED else BatchRelease.Condition.RELEASED
    ensure_release(batch, unit_un, location, quality_employee, condition=condition)
    return batch


@transaction.atomic
def seed_manufacturing_demo():
    employee, quality_employee = ensure_employee()
    output_item, raw_materials, packaging_materials, unit_un, location, supplier = ensure_inventory_master()
    raw_batches = ensure_raw_batches(raw_materials, location, supplier)
    formula = ensure_formula(output_item, [(item, quantity) for item, quantity in raw_materials], unit_un)

    master = (output_item, raw_materials, packaging_materials, unit_un, location, supplier)

    scenarios = [
        ("DEMO-MFG-LOTE-001", Stage.COMPLETE),
        ("DEMO-MFG-LOTE-002", Stage.DRAFT),
        ("DEMO-MFG-LOTE-003", Stage.IN_PROCESS),
        ("DEMO-MFG-LOTE-004", Stage.DEVIATION),
        ("DEMO-MFG-LOTE-005", Stage.REJECTED),
        ("DEMO-MFG-LOTE-006", Stage.PENDING_DOCS),
    ]
    batches = []
    for code, stage in scenarios:
        batch = build_scenario(code, stage, formula, master, employee, quality_employee, raw_batches)
        batches.append(batch)
    return batches


class Command(BaseCommand):
    help = "Carga varios lotes demo de produccion/manufactura (distintos estados y escenarios) para pruebas."

    def handle(self, *args, **options):
        batches = seed_manufacturing_demo()
        self.stdout.write(self.style.SUCCESS(f"Demo de produccion cargado: {len(batches)} lotes."))
        for batch in batches:
            order = batch.production_order
            self.stdout.write(f"  - {order.batch_code}: estado={batch.get_status_display()}")
