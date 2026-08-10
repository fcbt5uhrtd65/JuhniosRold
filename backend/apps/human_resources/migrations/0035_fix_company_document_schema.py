import uuid

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Migración correctiva: 0033_company_document quedó registrada como
    aplicada en producción con el contenido de una iteración anterior
    (CompanyDocument plano — name/file/visible_from/visible_until — sin
    categoría ni CompanyDocumentVersion) antes de que el archivo se
    reescribiera con el esquema final. Django no vuelve a ejecutar una
    migración ya marcada como aplicada aunque el archivo cambie después, así
    que la tabla real en la base de datos quedó desincronizada del estado
    que el modelo actual espera (columna "category" inexistente, tabla
    CompanyDocumentVersion nunca creada). Se confirmó que la tabla vieja
    está vacía (módulo recién publicado, sin documentos reales cargados),
    así que esta migración la elimina y crea el esquema correcto desde
    cero — sin necesidad de migrar datos."""

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("human_resources", "0033_company_document"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "DROP TABLE IF EXISTS human_resources_companydocumentversion CASCADE;"
                "DROP TABLE IF EXISTS human_resources_companydocument CASCADE;"
            ),
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[
                migrations.DeleteModel(name="CompanyDocumentVersion"),
                migrations.DeleteModel(name="CompanyDocument"),
            ],
        ),
        migrations.CreateModel(
            name="CompanyDocument",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("REGULATION", "Reglamento"),
                            ("POLICY", "Políticas"),
                            ("ANNOUNCEMENT", "Comunicados"),
                            ("FORM", "Formatos"),
                        ],
                        default="REGULATION",
                        max_length=20,
                    ),
                ),
                ("name", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True)),
            ],
            options={
                "ordering": ("category", "name"),
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="CompanyDocumentVersion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("version_number", models.PositiveIntegerField()),
                (
                    "file",
                    models.FileField(
                        upload_to="human_resources/company_documents/",
                        validators=[django.core.validators.FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg", "doc", "docx"))],
                    ),
                ),
                ("visible_from", models.DateField(blank=True, null=True)),
                ("visible_until", models.DateField(blank=True, null=True)),
                ("published_at", models.DateTimeField(auto_now_add=True)),
                (
                    "document",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="human_resources.companydocument",
                    ),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="uploaded_company_document_versions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-version_number",),
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="companydocumentversion",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("document", "version_number"),
                name="unique_active_version_per_document",
            ),
        ),
    ]
