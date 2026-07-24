from datetime import timedelta
from decimal import Decimal

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


DEMO_BATCH_CODE = "DEMO-MFG-LOTE-001"
DEMO_FORMULA_CODE = "DEMO-MFG-FRM-001"
DEMO_PREFIX = "DEMO-MFG"


def decimal(value):
    return Decimal(str(value))


def upsert(model, lookup, defaults):
    obj, _ = model.all_objects.update_or_create(
        **lookup,
        defaults={**defaults, "deleted_at": None},
    )
    return obj


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
    return upsert(
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
            {"quantity": formula_quantity * decimal("5"), "reserved_quantity": decimal("0")},
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


def ensure_batch(formula, output_item, unit_un, location, employee):
    today = timezone.localdate()
    area = upsert(Area, {"code": "DEMO-MFG-AREA"}, {"name": "Area demo produccion", "is_active": True})
    line = upsert(
        ProductionLine,
        {"code": "DEMO-MFG-LINEA"},
        {"name": "Linea demo de fabricacion", "area": area, "is_active": True},
    )

    production_order = ProductionOrder.objects.filter(batch_code=DEMO_BATCH_CODE).first()
    if production_order is None:
        production_order = ProductionOrder.objects.create(
            formula=formula,
            output_item=output_item,
            planned_quantity=decimal("100"),
            actual_quantity=decimal("98"),
            batch_code=DEMO_BATCH_CODE,
            started_at=today - timedelta(days=2),
            closed_at=today,
            responsible="Teo Produccion Demo",
            is_dispensed=True,
            is_output_received=True,
            status=ProductionOrder.Status.CLOSED,
            notes="Orden demo creada por seed_manufacturing_demo.",
        )
    else:
        production_order.formula = formula
        production_order.output_item = output_item
        production_order.planned_quantity = decimal("100")
        production_order.actual_quantity = decimal("98")
        production_order.started_at = today - timedelta(days=2)
        production_order.closed_at = today
        production_order.responsible = "Teo Produccion Demo"
        production_order.is_dispensed = True
        production_order.is_output_received = True
        production_order.status = ProductionOrder.Status.CLOSED
        production_order.notes = "Orden demo creada por seed_manufacturing_demo."
        production_order.save()

    batch = upsert(
        Batch,
        {"production_order": production_order},
        {
            "status": Batch.Status.RELEASED,
            "area": area,
            "production_line": line,
            "production_manager": employee,
            "quality_manager": employee,
            "scheduled_at": today - timedelta(days=3),
            "actual_start_at": timezone.now() - timedelta(days=2, hours=3),
            "actual_end_at": timezone.now() - timedelta(hours=2),
            "notes": "Lote demo completo para probar expediente, controles y PDF.",
            "created_by": None,
        },
    )

    BatchStatusHistory.objects.get_or_create(
        batch=batch,
        previous_status="",
        new_status=Batch.Status.RELEASED,
        reason="Seed demo lote completo",
        defaults={"changed_by": None, "observation": "Lote demo precargado en estado liberado."},
    )
    return batch, area, line


def ensure_dispensing(batch, raw_batches, employee):
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
    return order


def ensure_process_controls(batch, raw_batches, packaging_materials, unit_un, location, employee, area, line):
    now = timezone.now()
    today = timezone.localdate()

    for phase in (
        LineClearance.Phase.DISPENSING,
        LineClearance.Phase.MANUFACTURING,
        LineClearance.Phase.FILLING,
        LineClearance.Phase.PACKAGING,
    ):
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
            "area": area.name,
            "equipment": "Tanque mezclador DEMO",
            "cleaned_at": now - timedelta(days=2, hours=4),
            "previous_product": "Sin producto anterior - demo",
            "previous_batch_code": "N/A",
            "cleaning_method": "Limpieza y sanitizacion segun procedimiento demo.",
            "sanitizer": "Alcohol 70%",
            "sanitizer_concentration": "70%",
            "sanitizer_batch": "SAN-DEMO-001",
            "sanitizer_expires_at": today + timedelta(days=180),
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
            "removed_at": now - timedelta(hours=1),
            "removed_by": employee,
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
            "overall_result": WeightVolumeControl.OverallResult.APPROVED,
        },
    )
    weight.samples.all().delete()
    for sample_number, gross in enumerate(["0.520", "0.518", "0.521"], start=1):
        WeightVolumeSample.objects.create(
            control=weight,
            sample_number=sample_number,
            sampled_at=now - timedelta(days=1, hours=2),
            gross_weight=decimal(gross),
            tare=decimal("0.020"),
            volume=decimal("500"),
            result=ResultStatus.YES,
            observation="Muestra demo conforme.",
        )

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
            "observations": "Sin fugas en muestras demo.",
            "overall_result": SealIntegrityControl.OverallResult.APPROVED,
        },
    )
    seal.samples.all().delete()
    for sample_number in range(1, 4):
        SealIntegritySample.objects.create(
            control=seal,
            sample_number=sample_number,
            result=SealIntegritySample.Result.CONFORMING,
            observation="Conforme demo.",
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
    packaging.lot_markings.all().delete()
    for stage in (BatchLotMarking.Stage.INITIAL, BatchLotMarking.Stage.FINAL):
        BatchLotMarking.objects.create(
            packaging_control=packaging,
            stage=stage,
            printed_batch_code=DEMO_BATCH_CODE,
            manufacture_date=today - timedelta(days=2),
            expiry_date=today + timedelta(days=730),
            printed_at=now - timedelta(hours=5 if stage == BatchLotMarking.Stage.INITIAL else 1),
            is_legible=True,
            is_correctly_placed=True,
            result=ResultStatus.YES,
            performed_by=employee,
            verified_by=employee,
        )


def ensure_quality(batch, output_item, unit_un, location, employee):
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

    certificate = upsert(
        AnalysisCertificate,
        {"batch": batch},
        {
            "manufactured_at": today - timedelta(days=2),
            "sampled_at": today - timedelta(days=1),
            "analyzed_at": today,
            "analyzed_by": employee,
            "verified_by": employee,
            "concept": AnalysisCertificate.Concept.APPROVED,
            "observations": "Resultados demo conformes.",
        },
    )
    certificate.tests.all().delete()
    for test in spec.tests.all():
        AnalysisTestResult.objects.create(
            certificate=certificate,
            name=test.name,
            result_type="Conforme",
            unit=test.unit,
            specification=test.specification_text,
            lower_limit=test.lower_limit,
            upper_limit=test.upper_limit,
            method=test.method,
            equipment=test.equipment,
            bulk_result="Conforme" if test.name != "pH" else "6.5",
            finished_product_result="Conforme" if test.name != "pH" else "6.5",
            complies=True,
            observations="Resultado demo dentro de especificacion.",
            performed_by=employee,
            verified_by=employee,
        )

    upsert(
        MicrobiologyAnalysis,
        {"batch": batch},
        {
            "sample_code": f"{DEMO_BATCH_CODE}-MIC",
            "sample_type": "Producto terminado",
            "taken_at": today - timedelta(days=1),
            "taken_by": employee,
            "sent_at": today - timedelta(days=1),
            "laboratory": "Laboratorio demo",
            "report_number": "MIC-DEMO-001",
            "results": [{"ensayo": "Aerobios mesofilos", "resultado": "< 10 UFC/g", "cumple": True}],
            "specifications": [{"ensayo": "Aerobios mesofilos", "especificacion": "< 100 UFC/g"}],
            "overall_result": MicrobiologyAnalysis.OverallResult.APPROVED,
            "approved_at": today,
            "approved_by": employee,
            "observations": "Analisis microbiologico demo aprobado.",
        },
    )

    for code, name in DocumentChecklistItem.DocumentCode.choices:
        upsert(
            DocumentChecklistItem,
            {"batch": batch, "document_code": code},
            {
                "name": name,
                "format_code": f"DEMO-{code[:8]}",
                "format_version": "1.0",
                "applies": True,
                "result": ResultStatus.YES,
                "status": DocumentChecklistItem.Status.APPROVED,
                "responsible": employee,
                "verifier": employee,
                "filled_at": timezone.now() - timedelta(hours=2),
                "verified_at": timezone.now() - timedelta(hours=1),
                "observations": "Documento demo aprobado.",
                "blocks_release": False,
            },
        )

    upsert(
        BatchRelease,
        {"batch": batch},
        {
            "released_quantity": decimal("98"),
            "retained_quantity": decimal("1"),
            "rejected_quantity": decimal("1"),
            "unit": unit_un,
            "warehouse_location": location,
            "released_at": timezone.now(),
            "condition": BatchRelease.Condition.RELEASED,
            "released_by_quality": employee,
            "approved_by_technical_director": employee,
            "observations": "Lote demo liberado para pruebas funcionales.",
        },
    )


@transaction.atomic
def seed_manufacturing_demo():
    employee = ensure_employee()
    output_item, raw_materials, packaging_materials, unit_un, location, supplier = ensure_inventory_master()
    raw_batches = ensure_raw_batches(raw_materials, location, supplier)
    formula = ensure_formula(output_item, [(item, quantity) for item, quantity in raw_materials], unit_un)
    batch, area, line = ensure_batch(formula, output_item, unit_un, location, employee)
    ensure_dispensing(batch, raw_batches, employee)
    ensure_process_controls(batch, raw_batches, packaging_materials, unit_un, location, employee, area, line)
    ensure_quality(batch, output_item, unit_un, location, employee)
    return batch


class Command(BaseCommand):
    help = "Carga un unico ejemplo completo de produccion/manufactura para pruebas."

    def handle(self, *args, **options):
        batch = seed_manufacturing_demo()
        order = batch.production_order
        self.stdout.write(
            self.style.SUCCESS(
                "Demo de produccion cargado: "
                f"producto={order.output_item.code}, formula={order.formula.code}, lote={order.batch_code}."
            )
        )
