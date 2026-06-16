import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0003_enterprise_hr_employee_profile"),
    ]

    operations = [
        migrations.AddField(
            model_name="branch",
            name="country",
            field=models.CharField(blank=True, default="Colombia", max_length=80),
        ),
        migrations.AddField(
            model_name="branch",
            name="email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="branch",
            name="status",
            field=models.CharField(choices=[("ACTIVE", "Activa"), ("INACTIVE", "Inactiva")], default="ACTIVE", max_length=20),
        ),
        migrations.AddField(
            model_name="branch",
            name="responsible",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="responsible_branches", to="employees.employee"),
        ),
    ]
