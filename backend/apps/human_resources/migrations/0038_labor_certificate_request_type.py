from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("human_resources", "0037_attendance_duplicate_window_5"),
    ]

    operations = [
        migrations.AlterField(
            model_name="vacationrequest",
            name="request_type",
            field=models.CharField(
                choices=[
                    ("PERMISSION", "Permiso"),
                    ("OVERTIME", "Horas extras"),
                    ("LEAVE", "Licencia"),
                    ("INCAPACITY", "Incapacidad"),
                    ("VACATION", "Vacaciones"),
                    ("LOAN", "PrÃ©stamo"),
                    ("SCHEDULE_CHANGE", "Cambio de horario empleado"),
                    ("LABOR_CERTIFICATE", "Certificado laboral"),
                    ("OTHER", "Otro"),
                ],
                default="VACATION",
                max_length=20,
            ),
        ),
    ]
