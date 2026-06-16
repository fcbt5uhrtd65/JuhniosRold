import django.core.validators
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


def seed_hr_defaults(apps, _schema_editor):
    work_day = apps.get_model("employees", "WorkDay")
    field_configuration = apps.get_model("employees", "HRFieldConfiguration")

    for index, (code, name) in enumerate(
        (
            ("MONDAY", "Lunes"),
            ("TUESDAY", "Martes"),
            ("WEDNESDAY", "Miércoles"),
            ("THURSDAY", "Jueves"),
            ("FRIDAY", "Viernes"),
            ("SATURDAY", "Sábado"),
            ("SUNDAY", "Domingo"),
        ),
        start=1,
    ):
        work_day.objects.update_or_create(
            code=code,
            defaults={"name": name, "sort_order": index, "is_active": code != "SUNDAY"},
        )

    defaults = (
        ("PERSONAL", "document_type", "Tipo de documento", True),
        ("PERSONAL", "document_number", "Número de documento", True),
        ("PERSONAL", "document_issue_date", "Fecha de expedición", True),
        ("PERSONAL", "document_issue_place", "Lugar de expedición", True),
        ("PERSONAL", "first_name", "Nombres", True),
        ("PERSONAL", "last_name", "Apellidos", True),
        ("PERSONAL", "date_of_birth", "Fecha de nacimiento", True),
        ("PERSONAL", "phone", "Celular", True),
        ("PERSONAL", "email", "Correo electrónico", True),
        ("PERSONAL", "address", "Dirección de residencia", True),
        ("LABOR", "employee_code", "Código interno", True),
        ("LABOR", "position", "Cargo", True),
        ("LABOR", "department", "Área o dependencia", True),
        ("LABOR", "employment_type", "Tipo de vinculación", True),
        ("LABOR", "contract_type", "Tipo de contrato", True),
        ("LABOR", "hire_date", "Fecha de ingreso", True),
        ("LABOR", "base_salary", "Salario básico", True),
        ("LABOR", "status", "Estado del empleado", True),
        ("LABOR", "branch", "Sede o sucursal", True),
        ("DOCUMENTS", "employee_documents", "Gestión documental", False),
        ("ACCESS", "user_role", "Rol dentro del sistema", False),
    )
    for section, field_name, label, is_required in defaults:
        field_configuration.objects.update_or_create(
            section=section,
            field_name=field_name,
            defaults={"label": label, "is_required": is_required, "is_active": True},
        )


def noop_reverse(_apps, _schema_editor):
    return None


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0002_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Branch",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("code", models.CharField(max_length=30, unique=True)),
                ("name", models.CharField(max_length=150)),
                ("address", models.TextField(blank=True)),
                ("city", models.CharField(blank=True, max_length=120)),
                ("department", models.CharField(blank=True, max_length=120)),
                ("country", models.CharField(blank=True, default="Colombia", max_length=80)),
                ("phone", models.CharField(blank=True, max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("status", models.CharField(choices=[("ACTIVE", "Activa"), ("INACTIVE", "Inactiva")], default="ACTIVE", max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("responsible", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="responsible_branches", to="employees.employee")),
            ],
            options={
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="WorkDay",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("code", models.CharField(max_length=20, unique=True)),
                ("name", models.CharField(max_length=30)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ("sort_order", "name"),
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="HRFieldConfiguration",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                (
                    "section",
                    models.CharField(
                        choices=[
                            ("PERSONAL", "Información personal"),
                            ("LABOR", "Información laboral"),
                            ("SOCIAL_SECURITY", "Seguridad social"),
                            ("BANKING", "Datos bancarios"),
                            ("PAYROLL", "Nómina"),
                            ("EMERGENCY", "Contacto de emergencia"),
                            ("DOCUMENTS", "Documentos"),
                            ("ACCESS", "Acceso al sistema"),
                        ],
                        max_length=30,
                    ),
                ),
                ("field_name", models.CharField(max_length=120)),
                ("label", models.CharField(max_length=180)),
                ("is_required", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("help_text", models.TextField(blank=True)),
                ("choices", models.JSONField(blank=True, default=list)),
            ],
            options={
                "ordering": ("section", "field_name"),
                "abstract": False,
            },
        ),
        migrations.AddField(
            model_name="employee",
            name="arl",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="employee",
            name="arl_risk_level",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="employee",
            name="bank_account_holder",
            field=models.CharField(blank=True, max_length=180),
        ),
        migrations.AddField(
            model_name="employee",
            name="bank_account_holder_document",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="employee",
            name="bank_account_number",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="employee",
            name="bank_account_type",
            field=models.CharField(blank=True, choices=[("SAVINGS", "Ahorros"), ("CHECKING", "Corriente")], max_length=20),
        ),
        migrations.AddField(
            model_name="employee",
            name="bank_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="employee",
            name="base_salary",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14, validators=[django.core.validators.MinValueValidator(0)]),
        ),
        migrations.AddField(
            model_name="employee",
            name="branch",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="employees", to="employees.branch"),
        ),
        migrations.AddField(
            model_name="employee",
            name="city",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="employee",
            name="compensation_fund",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="employee",
            name="contract_type",
            field=models.CharField(
                choices=[
                    ("INDEFINITE", "Indefinido"),
                    ("FIXED_TERM", "Término fijo"),
                    ("SERVICES", "Prestación de servicios"),
                    ("APPRENTICESHIP", "Aprendizaje"),
                    ("INTERNSHIP", "Práctica"),
                    ("OTHER", "Otro"),
                ],
                default="INDEFINITE",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="employee",
            name="cost_center",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="employee",
            name="created_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_employee_profiles", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="employee",
            name="date_of_birth",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="document_issue_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="document_issue_place",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="employee",
            name="document_type",
            field=models.CharField(blank=True, choices=[("CC", "Cédula de ciudadanía"), ("CE", "Cédula de extranjería"), ("PASSPORT", "Pasaporte"), ("NIT", "NIT"), ("OTHER", "Otro")], max_length=20),
        ),
        migrations.AddField(
            model_name="employee",
            name="emergency_contact_address",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="emergency_contact_alternate_phone",
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name="employee",
            name="emergency_contact_mobile",
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name="employee",
            name="emergency_contact_name",
            field=models.CharField(blank=True, max_length=180),
        ),
        migrations.AddField(
            model_name="employee",
            name="emergency_contact_relationship",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="employee",
            name="employment_type",
            field=models.CharField(choices=[("EMPLOYEE", "Empleado"), ("SENA_APPRENTICE", "Aprendiz SENA"), ("INTERN", "Practicante"), ("CONTRACTOR", "Contratista")], default="EMPLOYEE", max_length=30),
        ),
        migrations.AddField(
            model_name="employee",
            name="eps",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="employee",
            name="gender",
            field=models.CharField(blank=True, choices=[("FEMALE", "Femenino"), ("MALE", "Masculino"), ("NON_BINARY", "No binario"), ("OTHER", "Otro"), ("NOT_SPECIFIED", "Prefiere no decir")], max_length=20),
        ),
        migrations.AddField(
            model_name="employee",
            name="integral_salary",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="employee",
            name="marital_status",
            field=models.CharField(blank=True, choices=[("SINGLE", "Soltero/a"), ("MARRIED", "Casado/a"), ("FREE_UNION", "Unión libre"), ("DIVORCED", "Divorciado/a"), ("WIDOWED", "Viudo/a"), ("OTHER", "Otro")], max_length=20),
        ),
        migrations.AddField(
            model_name="employee",
            name="nationality",
            field=models.CharField(blank=True, default="Colombiana", max_length=80),
        ),
        migrations.AddField(
            model_name="employee",
            name="pension_fund",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="employee",
            name="photo",
            field=models.FileField(blank=True, upload_to="employees/photos/"),
        ),
        migrations.AddField(
            model_name="employee",
            name="profile_status",
            field=models.CharField(choices=[("DRAFT", "Borrador"), ("REGISTERED", "Registrado"), ("INCOMPLETE", "Incompleto"), ("COMPLETE", "Completo"), ("DOCUMENTED", "Documentado"), ("RETIRED", "Retirado")], default="REGISTERED", max_length=20),
        ),
        migrations.AddField(
            model_name="employee",
            name="residence_department",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="employee",
            name="salary_type",
            field=models.CharField(choices=[("FIXED", "Fijo"), ("VARIABLE", "Variable"), ("INTEGRAL", "Integral")], default="FIXED", max_length=20),
        ),
        migrations.AddField(
            model_name="employee",
            name="severance_fund",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="employee",
            name="termination_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="transport_allowance_applies",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="employee",
            name="updated_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="updated_employee_profiles", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="employee",
            name="weekly_working_hours",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="work_modality",
            field=models.CharField(blank=True, choices=[("ONSITE", "Presencial"), ("REMOTE", "Remoto"), ("HYBRID", "Híbrido")], max_length=20),
        ),
        migrations.AddField(
            model_name="employee",
            name="work_observations",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="employee",
            name="working_days",
            field=models.ManyToManyField(blank=True, related_name="employees", to="employees.workday"),
        ),
        migrations.AlterField(
            model_name="employee",
            name="department",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="employees", to="employees.department"),
        ),
        migrations.AlterField(
            model_name="employee",
            name="document_number",
            field=models.CharField(blank=True, max_length=50, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name="employee",
            name="email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AlterField(
            model_name="employee",
            name="employee_code",
            field=models.CharField(blank=True, max_length=30, unique=True),
        ),
        migrations.AlterField(
            model_name="employee",
            name="first_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AlterField(
            model_name="employee",
            name="hire_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="employee",
            name="last_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AlterField(
            model_name="employee",
            name="position",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="employees", to="employees.position"),
        ),
        migrations.AlterField(
            model_name="employee",
            name="status",
            field=models.CharField(choices=[("ACTIVE", "Activo"), ("INACTIVE", "Inactivo"), ("LEAVE", "En licencia"), ("SUSPENDED", "Suspendido"), ("TERMINATED", "Retirado")], default="ACTIVE", max_length=20),
        ),
        migrations.CreateModel(
            name="EmployeeChangeLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("field_name", models.CharField(max_length=120)),
                ("old_value", models.TextField(blank=True)),
                ("new_value", models.TextField(blank=True)),
                ("changed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="change_logs", to="employees.employee")),
            ],
            options={
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="EmployeeSalaryHistory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("previous_salary", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("new_salary", models.DecimalField(decimal_places=2, max_digits=14)),
                ("start_date", models.DateField(default=django.utils.timezone.localdate)),
                ("reason", models.TextField(blank=True)),
                ("changed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="salary_history", to="employees.employee")),
            ],
            options={
                "ordering": ("-start_date", "-created_at"),
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="EmployeePositionHistory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("start_date", models.DateField(default=django.utils.timezone.localdate)),
                ("reason", models.TextField(blank=True)),
                ("changed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="position_history", to="employees.employee")),
                ("new_position", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="employee_movements", to="employees.position")),
                ("previous_position", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="previous_employee_movements", to="employees.position")),
            ],
            options={
                "ordering": ("-start_date", "-created_at"),
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="hrfieldconfiguration",
            constraint=models.UniqueConstraint(fields=("section", "field_name"), name="unique_hr_field_configuration"),
        ),
        migrations.RunPython(seed_hr_defaults, noop_reverse),
    ]
