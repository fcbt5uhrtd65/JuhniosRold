import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0003_enterprise_hr_employee_profile"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=[
                        """
                        ALTER TABLE employees_branch
                        ADD COLUMN IF NOT EXISTS country varchar(80) NOT NULL DEFAULT 'Colombia'
                        """,
                        """
                        ALTER TABLE employees_branch
                        ADD COLUMN IF NOT EXISTS email varchar(254) NOT NULL DEFAULT ''
                        """,
                        """
                        ALTER TABLE employees_branch
                        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'ACTIVE'
                        """,
                        """
                        ALTER TABLE employees_branch
                        ADD COLUMN IF NOT EXISTS responsible_id uuid NULL
                        """,
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
                        """,
                    ],
                    reverse_sql=[
                        "ALTER TABLE employees_branch DROP CONSTRAINT IF EXISTS employees_branch_responsible_id_aea1aa82_fk_employees",
                        "ALTER TABLE employees_branch DROP COLUMN IF EXISTS responsible_id",
                        "ALTER TABLE employees_branch DROP COLUMN IF EXISTS status",
                        "ALTER TABLE employees_branch DROP COLUMN IF EXISTS email",
                        "ALTER TABLE employees_branch DROP COLUMN IF EXISTS country",
                    ],
                ),
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
