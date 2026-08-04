from django.db import migrations, models


def copy_legacy_managers(apps, schema_editor):
    Employee = apps.get_model("employees", "Employee")
    through = Employee.immediate_managers.through
    rows = [
        through(from_employee_id=employee.id, to_employee_id=employee.manager_id)
        for employee in Employee.objects.exclude(manager_id__isnull=True).only("id", "manager_id")
        if employee.id != employee.manager_id
    ]
    through.objects.bulk_create(rows, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0009_employee_signature_updated_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="immediate_managers",
            field=models.ManyToManyField(blank=True, related_name="managed_employees", to="employees.employee"),
        ),
        migrations.RunPython(copy_legacy_managers, migrations.RunPython.noop),
    ]
