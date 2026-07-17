from django.db import migrations

from apps.identity.access_control import ROLE_DEFINITIONS, COMPONENT_DEFINITIONS, build_default_role_permissions

NEW_ROLE_CODES = (
    "PLANEACION",
    "DISPENSADOR",
    "VERIFICADOR_DISPENSACION",
    "OPERARIO_PRODUCCION",
    "SUPERVISOR_PRODUCCION",
    "OPERARIO_LLENADO",
    "OPERARIO_ACONDICIONAMIENTO",
    "ASEGURAMIENTO_CALIDAD",
    "CONTROL_CALIDAD",
    "DIRECTOR_TECNICO",
    "AUDITOR",
)


def sync_manufacturing_roles(apps, schema_editor):
    Role = apps.get_model("identity", "Role")
    Component = apps.get_model("identity", "Component")
    RoleComponentPermission = apps.get_model("identity", "RoleComponentPermission")

    role_by_code = {role_def["code"]: role_def for role_def in ROLE_DEFINITIONS}
    roles_by_code = {}
    for code in NEW_ROLE_CODES:
        role_def = role_by_code[code]
        role, _ = Role.objects.update_or_create(
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
        roles_by_code[code] = role

    component_by_code = {
        component.code: component
        for component in Component.objects.filter(code__in=[c["code"] for c in COMPONENT_DEFINITIONS])
    }

    permissions_matrix = build_default_role_permissions()
    for role_code in NEW_ROLE_CODES:
        role = roles_by_code[role_code]
        for component_code, permission_data in permissions_matrix.get(role_code, {}).items():
            component = component_by_code.get(component_code)
            if not component:
                continue
            RoleComponentPermission.objects.update_or_create(
                role=role,
                component=component,
                defaults={
                    "can_view": permission_data.get("can_view", False),
                    "can_edit": permission_data.get("can_edit", False),
                },
            )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0009_sync_manufacturing_component"),
    ]

    operations = [
        migrations.RunPython(sync_manufacturing_roles, noop),
    ]
