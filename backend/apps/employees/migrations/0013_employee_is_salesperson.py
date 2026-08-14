from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0012_employee_uniform_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="is_salesperson",
            field=models.BooleanField(default=False),
        ),
    ]
