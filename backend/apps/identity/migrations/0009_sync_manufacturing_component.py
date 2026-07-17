from django.db import migrations

from apps.identity.access_control import COMPONENT_DEFINITIONS, build_default_role_permissions


def sync_manufacturing_component(apps, schema_editor):
    Role = apps.get_model("identity", "Role")
    Component = apps.get_model("identity", "Component")
    RoleComponentPermission = apps.get_model("identity", "RoleComponentPermission")

    component_by_code = {}
    for component_def in COMPONENT_DEFINITIONS:
        component, _ = Component.objects.update_or_create(
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
        role = Role.objects.filter(code=role_code).first()
        if not role:
            continue
        for component_code, permission_data in component_permissions.items():
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


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0008_sync_referrals_component"),
    ]

    operations = [
        migrations.RunPython(sync_manufacturing_component, migrations.RunPython.noop),
    ]
