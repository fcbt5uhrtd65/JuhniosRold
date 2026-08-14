from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0011_branch_legal_name_nit"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="uniform_sweater",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="employee",
            name="uniform_pants",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="employee",
            name="uniform_shoes",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="employee",
            name="uniform_other",
            field=models.TextField(blank=True),
        ),
    ]
