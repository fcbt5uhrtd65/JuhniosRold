from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0013_employee_is_salesperson"),
        ("human_resources", "0039_payslip_document"),
    ]

    operations = [
        migrations.AddField(
            model_name="companydocument",
            name="branches",
            field=models.ManyToManyField(
                blank=True,
                help_text="Sedes a las que aplica. Si se deja vacio, el documento aplica a todos los colaboradores.",
                related_name="company_documents",
                to="employees.branch",
            ),
        ),
    ]
