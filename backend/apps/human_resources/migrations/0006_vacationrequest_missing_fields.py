import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0003_enterprise_hr_employee_profile"),
        ("human_resources", "0005_employee_documents_notifications"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Fields missing from vacationrequest
        migrations.AddField(
            model_name="vacationrequest",
            name="request_number",
            field=models.CharField(blank=True, max_length=30, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="vacationrequest",
            name="subtype",
            field=models.CharField(blank=True, choices=[
                ("PERSONAL", "Personal"),
                ("MEDICAL", "Médico"),
                ("ACADEMIC", "Académico"),
                ("FAMILY", "Familiar"),
                ("DAYTIME", "Diurnas"),
                ("NIGHT", "Nocturnas"),
                ("SUNDAY", "Dominicales"),
                ("HOLIDAY", "Festivas"),
                ("MATERNITY", "Maternidad"),
                ("PATERNITY", "Paternidad"),
                ("BEREAVEMENT", "Luto"),
                ("MARRIAGE", "Matrimonio"),
                ("DOMESTIC_CALAMITY", "Calamidad doméstica"),
                ("UNPAID", "No remunerada"),
                ("GENERAL_ILLNESS", "Enfermedad general"),
                ("WORK_ACCIDENT", "Accidente laboral"),
                ("COMMON_ACCIDENT", "Accidente común"),
                ("OCCUPATIONAL_DISEASE", "Enfermedad laboral"),
                ("INDIVIDUAL", "Individuales"),
                ("COLLECTIVE", "Colectivas"),
                ("SHIFT_CHANGE", "Cambio de turno"),
                ("SCHEDULE_CHANGE", "Cambio de horario"),
                ("ADMINISTRATIVE", "Solicitud administrativa"),
                ("OTHER", "Otro"),
            ], max_length=40),
        ),
        migrations.AddField(
            model_name="vacationrequest",
            name="days_count",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name="vacationrequest",
            name="hours_count",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=7, null=True),
        ),
        migrations.AddField(
            model_name="vacationrequest",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="vacationrequest",
            name="observations",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="vacationrequest",
            name="due_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="vacationrequest",
            name="request_type",
            field=models.CharField(choices=[
                ("PERMISSION", "Permiso"),
                ("OVERTIME", "Horas extras"),
                ("LEAVE", "Licencia"),
                ("INCAPACITY", "Incapacidad"),
                ("VACATION", "Vacaciones"),
                ("OTHER", "Otro"),
            ], default="VACATION", max_length=20),
        ),
        migrations.AlterField(
            model_name="vacationrequest",
            name="status",
            field=models.CharField(choices=[
                ("PENDING", "Pendiente"),
                ("IN_REVIEW", "En revisión"),
                ("APPROVED", "Aprobada"),
                ("REJECTED", "Rechazada"),
                ("EXPIRED", "Vencida"),
            ], default="PENDING", max_length=20),
        ),
        # New tables
        migrations.CreateModel(
            name="VacationRequestAttachment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("attachment_type", models.CharField(choices=[("CERTIFICATE", "Certificado"), ("INCAPACITY", "Incapacidad"), ("MEDICAL_SUPPORT", "Soporte médico"), ("ADDITIONAL", "Documento adicional")], default="ADDITIONAL", max_length=30)),
                ("name", models.CharField(max_length=180)),
                ("file", models.FileField(upload_to="hr/requests/attachments/", validators=[FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg", "doc", "docx"))])),
                ("request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="human_resources.vacationrequest")),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="VacationRequestApprovalStep",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("step", models.CharField(choices=[("REQUESTER", "Solicitante"), ("MANAGER", "Jefe inmediato"), ("HR", "RRHH"), ("FINAL", "Aprobación final")], max_length=20)),
                ("sequence", models.PositiveSmallIntegerField(default=1)),
                ("status", models.CharField(choices=[("PENDING", "Pendiente"), ("IN_REVIEW", "En revisión"), ("APPROVED", "Aprobada"), ("REJECTED", "Rechazada"), ("EXPIRED", "Vencida")], default="PENDING", max_length=20)),
                ("acted_at", models.DateTimeField(blank=True, null=True)),
                ("comment", models.TextField(blank=True)),
                ("request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="approval_steps", to="human_resources.vacationrequest")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("sequence", "created_at"),
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="VacationRequestHistory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("action", models.CharField(choices=[("CREATED", "Creación"), ("UPDATED", "Cambio"), ("APPROVED", "Aprobación"), ("REJECTED", "Rechazo"), ("COMMENTED", "Comentario")], max_length=20)),
                ("old_status", models.CharField(blank=True, max_length=20)),
                ("new_status", models.CharField(blank=True, max_length=20)),
                ("comment", models.TextField(blank=True)),
                ("request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="history", to="human_resources.vacationrequest")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="vacationrequestapprovalstep",
            constraint=models.UniqueConstraint(fields=("request", "step"), name="unique_request_approval_step"),
        ),
    ]
