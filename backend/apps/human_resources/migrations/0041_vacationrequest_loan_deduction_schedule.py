from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("human_resources", "0040_company_document_branches"),
    ]

    operations = [
        migrations.AddField(
            model_name="vacationrequest",
            name="permission_deduction_schedule",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Cortes de nomina indicados por el trabajador para descontar un permiso si aplica.",
            ),
        ),
        migrations.AddField(
            model_name="vacationrequest",
            name="loan_deduction_schedule",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Cortes de nomina autorizados por el trabajador para descontar el prestamo.",
            ),
        ),
    ]
