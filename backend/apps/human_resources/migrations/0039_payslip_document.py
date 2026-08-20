import django.core.validators
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("employees", "0013_employee_is_salesperson"),
        ("human_resources", "0038_labor_certificate_request_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="PayslipDocument",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("title", models.CharField(max_length=180)),
                ("period_start", models.DateField()),
                ("period_end", models.DateField()),
                ("payment_date", models.DateField(blank=True, null=True)),
                (
                    "file",
                    models.FileField(
                        upload_to="hr/payslips/",
                        validators=[django.core.validators.FileExtensionValidator(allowed_extensions=("pdf",))],
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("DRAFT", "Borrador"), ("PUBLISHED", "Publicado")],
                        default="PUBLISHED",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                (
                    "employee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payslip_documents",
                        to="employees.employee",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="uploaded_payslip_documents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-period_end", "-payment_date", "-created_at"),
            },
        ),
        migrations.AddIndex(
            model_name="payslipdocument",
            index=models.Index(fields=["employee", "period_end"], name="human_resou_employee_15d3ea_idx"),
        ),
        migrations.AddIndex(
            model_name="payslipdocument",
            index=models.Index(fields=["status", "period_end"], name="human_resou_status_c2a858_idx"),
        ),
    ]
