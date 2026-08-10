from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0010_employee_immediate_managers"),
    ]

    operations = [
        migrations.AddField(
            model_name="branch",
            name="legal_name",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Razón social (NIT propio) a la que pertenece esta sede — puede diferir de otras "
                    "sedes. Se usa en documentos oficiales (ej. PDF de solicitudes de préstamo) en vez "
                    "de un nombre de empresa fijo."
                ),
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name="branch",
            name="nit",
            field=models.CharField(blank=True, max_length=30),
        ),
    ]
