from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("human_resources", "0035_fix_company_document_schema"),
    ]

    operations = [
        migrations.AlterField(
            model_name="companydocument",
            name="category",
            field=models.CharField(
                choices=[
                    ("REGULATION", "Reglamento"),
                    ("POLICY", "Políticas"),
                    ("ANNOUNCEMENT", "Circulares"),
                    ("FORM", "Formatos"),
                    ("MISSION_VISION", "Misión y Visión"),
                ],
                default="REGULATION",
                max_length=20,
            ),
        ),
    ]
