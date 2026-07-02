from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class AddFieldIfNotExists(migrations.AddField):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        field = model._meta.get_field(self.name)
        with schema_editor.connection.cursor() as cursor:
            columns = {
                column.name
                for column in schema_editor.connection.introspection.get_table_description(
                    cursor, model._meta.db_table
                )
            }
        if field.column in columns:
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)


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
        ("human_resources", "0006_vacationrequest_missing_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="vacationrequest",
            name="status",
            field=models.CharField(choices=STATUS_CHOICES, default="PENDING", max_length=20),
        ),
        AddFieldIfNotExists(
            model_name="vacationrequest",
            name="admin_decision",
            field=models.CharField(blank=True, choices=STATUS_CHOICES, max_length=20),
        ),
        AddFieldIfNotExists(
            model_name="vacationrequest",
            name="admin_decided_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="hr_admin_decisions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        AddFieldIfNotExists(
            model_name="vacationrequest",
            name="admin_decided_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        AddFieldIfNotExists(
            model_name="vacationrequest",
            name="admin_comment",
            field=models.TextField(blank=True),
        ),
        AddFieldIfNotExists(
            model_name="vacationrequest",
            name="hr_decision",
            field=models.CharField(blank=True, choices=STATUS_CHOICES, max_length=20),
        ),
        AddFieldIfNotExists(
            model_name="vacationrequest",
            name="hr_decided_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="hr_rrhh_decisions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        AddFieldIfNotExists(
            model_name="vacationrequest",
            name="hr_decided_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        AddFieldIfNotExists(
            model_name="vacationrequest",
            name="hr_comment",
            field=models.TextField(blank=True),
        ),
    ]
