from django.db import migrations, models


def cap_duplicate_window(apps, schema_editor):
    settings_model = apps.get_model("human_resources", "AttendanceIntelligenceSettings")
    settings_model.objects.filter(duplicate_punch_window_minutes__gt=5).update(duplicate_punch_window_minutes=5)


class Migration(migrations.Migration):

    dependencies = [
        ("human_resources", "0036_company_document_mission_vision_category"),
    ]

    operations = [
        migrations.AlterField(
            model_name="attendanceintelligencesettings",
            name="duplicate_punch_window_minutes",
            field=models.PositiveIntegerField(
                default=5,
                help_text="Marcaciones del mismo empleado separadas por menos de este tiempo se consideran "
                "el mismo evento repetido por error (ej. marco, creyo que fallo, volvio a marcar) "
                "y se colapsan en una sola en vez de contarse como entrada+salida real.",
            ),
        ),
        migrations.RunPython(cap_duplicate_window, migrations.RunPython.noop),
    ]
