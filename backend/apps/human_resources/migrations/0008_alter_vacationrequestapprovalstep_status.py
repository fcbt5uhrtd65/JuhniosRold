from django.db import migrations, models


STATUS_CHOICES = [
    ("PENDING", "Pendiente"),
    ("IN_REVIEW", "En revisión"),
    ("PENDING_HR", "Pendiente por Recursos Humanos"),
    ("PENDING_ADMIN", "Pendiente por Administrador"),
    ("APPROVED", "Aprobada"),
    ("REJECTED", "Rechazada"),
    ("CANCELLED", "Cancelada"),
    ("FINALIZED", "Finalizada"),
    ("EXPIRED", "Vencida"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("human_resources", "0007_two_approver_flow"),
    ]

    operations = [
        migrations.AlterField(
            model_name="vacationrequestapprovalstep",
            name="status",
            field=models.CharField(choices=STATUS_CHOICES, default="PENDING", max_length=20),
        ),
    ]
