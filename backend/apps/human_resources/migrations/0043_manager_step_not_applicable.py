from django.db import migrations


def mark_pending_manager_steps_not_applicable(apps, schema_editor):
    """Los jefes inmediatos ya no participan en la aprobación.

    Los pasos "Jefe inmediato" que siguen pendientes (sin decisión) pasan a
    "No aplica", igual que en las solicitudes nuevas. Los que ya tienen una
    decisión registrada (aprobada o rechazada) no se tocan.
    """
    Step = apps.get_model("human_resources", "VacationRequestApprovalStep")
    Step.objects.filter(step="MANAGER", status="PENDING", acted_at__isnull=True).update(
        status="CANCELLED",
        user=None,
        comment="No aplica: la aprobación la realizan Recursos Humanos y Gerencia.",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("human_resources", "0042_payslipdocument_viewed_at"),
    ]

    operations = [
        migrations.RunPython(mark_pending_manager_steps_not_applicable, migrations.RunPython.noop),
    ]
