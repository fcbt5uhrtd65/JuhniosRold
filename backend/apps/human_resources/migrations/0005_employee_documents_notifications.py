import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0003_enterprise_hr_employee_profile"),
        ("human_resources", "0004_vacation_request_support_document"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
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
        migrations.AlterField(
            model_name="employeedocument",
            name="document_type",
            field=models.CharField(
                choices=[
                    ("ID_COPY", "Copia de cédula"),
                    ("RESUME", "Hoja de vida con soportes"),
                    ("SIGNED_CONTRACT", "Contrato firmado"),
                    ("BANK_CERTIFICATE", "Certificado bancario"),
                    ("EPS_CERTIFICATE", "Certificado EPS"),
                    ("PENSION_CERTIFICATE", "Certificado de pensión"),
                    ("SEVERANCE_CERTIFICATE", "Certificado de cesantías"),
                    ("ARL_CERTIFICATE", "Certificado ARL"),
                    ("COMPENSATION_CERTIFICATE", "Certificado Caja de Compensación"),
                    ("WORK_CERTIFICATE", "Certificados laborales"),
                    ("OTHER", "Otros documentos"),
                ],
                max_length=100,
            ),
        ),
        migrations.AlterField(
            model_name="employeedocument",
            name="file",
            field=models.FileField(blank=True, upload_to="employees/documents/"),
        ),
        migrations.AddField(
            model_name="employeedocument",
            name="issued_at",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="employeedocument",
            name="observations",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="employeedocument",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pendiente"),
                    ("LOADED", "Cargado"),
                    ("REJECTED", "Rechazado"),
                    ("EXPIRED", "Vencido"),
                    ("NOT_APPLICABLE", "No aplica"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="employeedocument",
            name="uploaded_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="employeedocument",
            name="uploaded_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="uploaded_employee_documents", to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name="HRNotification",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                (
                    "notification_type",
                    models.CharField(
                        choices=[
                            ("DOCUMENT_EXPIRED", "Documento vencido"),
                            ("DOCUMENT_EXPIRING", "Documento por vencer"),
                            ("MISSING_DOCUMENT", "Documento pendiente"),
                            ("GENERAL", "General"),
                        ],
                        max_length=30,
                    ),
                ),
                ("title", models.CharField(max_length=180)),
                ("message", models.TextField()),
                ("due_date", models.DateField(blank=True, null=True)),
                ("status", models.CharField(choices=[("UNREAD", "Sin leer"), ("READ", "Leída"), ("DISMISSED", "Descartada")], default="UNREAD", max_length=20)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_hr_notifications", to=settings.AUTH_USER_MODEL)),
                ("document", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="human_resources.employeedocument")),
                ("employee", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="hr_notifications", to="employees.employee")),
            ],
            options={
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
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
