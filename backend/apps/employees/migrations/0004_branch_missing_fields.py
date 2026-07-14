import django.db.models.deletion
from django.db import migrations, models

# La base de datos de producción (Postgres) ya tenía algunas de estas columnas
# aplicadas manualmente antes de que existiera esta migración, por lo que el
# ALTER TABLE debe ser idempotente ahí (ver commit "arreglo de errores"). Esa
# sintaxis (ADD COLUMN IF NOT EXISTS, bloques DO $$) es específica de Postgres
# y rompe el `migrate` en SQLite (usado en tests), así que solo se ejecuta
# cuando el vendor es postgresql; en cualquier otro motor se usa AddField/
# AddConstraint normales, que son no-destructivos y seguros de repetir.


def add_branch_columns(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "ALTER TABLE employees_branch "
            "ADD COLUMN IF NOT EXISTS country varchar(80) NOT NULL DEFAULT 'Colombia'"
        )
        cursor.execute(
            "ALTER TABLE employees_branch "
            "ADD COLUMN IF NOT EXISTS email varchar(254) NOT NULL DEFAULT ''"
        )
        cursor.execute(
            "ALTER TABLE employees_branch "
            "ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'ACTIVE'"
        )
        cursor.execute(
            "ALTER TABLE employees_branch "
            "ADD COLUMN IF NOT EXISTS responsible_id uuid NULL"
        )
        cursor.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'employees_branch_responsible_id_aea1aa82_fk_employees'
                ) THEN
                    ALTER TABLE employees_branch
                    ADD CONSTRAINT employees_branch_responsible_id_aea1aa82_fk_employees
                    FOREIGN KEY (responsible_id)
                    REFERENCES employees_employee(id)
                    DEFERRABLE INITIALLY DEFERRED;
                END IF;
            END
            $$;
            """
        )


def remove_branch_columns(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "ALTER TABLE employees_branch DROP CONSTRAINT IF EXISTS "
            "employees_branch_responsible_id_aea1aa82_fk_employees"
        )
        cursor.execute("ALTER TABLE employees_branch DROP COLUMN IF EXISTS responsible_id")
        cursor.execute("ALTER TABLE employees_branch DROP COLUMN IF EXISTS status")
        cursor.execute("ALTER TABLE employees_branch DROP COLUMN IF EXISTS email")
        cursor.execute("ALTER TABLE employees_branch DROP COLUMN IF EXISTS country")


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0003_enterprise_hr_employee_profile"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_branch_columns, remove_branch_columns),
            ],
            state_operations=[
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
                    field=models.CharField(
                        choices=[("ACTIVE", "Activa"), ("INACTIVE", "Inactiva")],
                        default="ACTIVE",
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name="branch",
                    name="responsible",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="responsible_branches",
                        to="employees.employee",
                    ),
                ),
            ],
        ),
    ]
