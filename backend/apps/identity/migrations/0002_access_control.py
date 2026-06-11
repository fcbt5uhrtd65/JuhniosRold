import uuid

from django.db import migrations, models
from django.db.models import deletion

from apps.identity.access_control import (
    COMPONENT_DEFINITIONS,
    ROLE_DEFINITIONS,
    build_default_role_permissions,
)


def seed_access_control(apps, schema_editor):
    Role = apps.get_model("identity", "Role")
    Component = apps.get_model("identity", "Component")
    RoleComponentPermission = apps.get_model("identity", "RoleComponentPermission")
    User = apps.get_model("identity", "User")

    role_by_code = {}
    for role_def in ROLE_DEFINITIONS:
        role, _ = Role.all_objects.update_or_create(
            code=role_def["code"],
            defaults={
                "name": role_def["name"],
                "description": role_def["description"],
                "is_superuser": role_def["is_superuser"],
                "is_default": role_def["is_default"],
                "is_active": True,
                "deleted_at": None,
            },
        )
        role_by_code[role.code] = role

    component_by_code = {}
    for component_def in COMPONENT_DEFINITIONS:
        component, _ = Component.all_objects.update_or_create(
            code=component_def["code"],
            defaults={
                "name": component_def["name"],
                "description": component_def["description"],
                "is_active": True,
                "deleted_at": None,
            },
        )
        component_by_code[component.code] = component

    permissions_matrix = build_default_role_permissions()
    for role_code, component_permissions in permissions_matrix.items():
        role = role_by_code[role_code]
        for component_code, permission_data in component_permissions.items():
            RoleComponentPermission.all_objects.update_or_create(
                role=role,
                component=component_by_code[component_code],
                defaults={
                    "can_view": permission_data.get("can_view", False),
                    "can_edit": permission_data.get("can_edit", False),
                },
            )

    for user in User.objects.all():
        if user.role_id:
            continue

        if user.is_superuser or user.is_staff:
            role = role_by_code["ADMIN"]
        else:
            first_group = user.groups.values_list("name", flat=True).first()
            role_code = (first_group or "CLIENT").upper()
            role = role_by_code.get(role_code) or role_by_code["CLIENT"]

        user.role_id = role.id
        user.save(update_fields=("role",))


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="Role",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("code", models.CharField(max_length=50, unique=True)),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True)),
                ("is_superuser", models.BooleanField(default=False)),
                ("is_default", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "role",
                "verbose_name_plural": "roles",
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="Component",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("code", models.CharField(max_length=120, unique=True)),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "component",
                "verbose_name_plural": "components",
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="RoleComponentPermission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("can_view", models.BooleanField(default=False)),
                ("can_edit", models.BooleanField(default=False)),
                (
                    "component",
                    models.ForeignKey(
                        on_delete=deletion.CASCADE,
                        related_name="role_permissions",
                        to="identity.component",
                    ),
                ),
                (
                    "role",
                    models.ForeignKey(
                        on_delete=deletion.CASCADE,
                        related_name="component_permissions",
                        to="identity.role",
                    ),
                ),
            ],
            options={
                "verbose_name": "role component permission",
                "verbose_name_plural": "role component permissions",
                "ordering": ("role__code", "component__code"),
            },
        ),
        migrations.AddField(
            model_name="user",
            name="role",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=deletion.PROTECT,
                related_name="users",
                to="identity.role",
            ),
        ),
        migrations.RunPython(seed_access_control, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.ForeignKey(
                on_delete=deletion.PROTECT,
                related_name="users",
                to="identity.role",
            ),
        ),
    ]
