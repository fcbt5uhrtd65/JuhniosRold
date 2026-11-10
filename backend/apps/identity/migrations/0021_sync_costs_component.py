from django.db import migrations

from apps.identity.access_control import COMPONENT_DEFINITIONS, build_default_role_permissions


def sync_costs_component(apps, schema_editor):
    """Crea el componente ``costs.management`` y resincroniza la matriz."""
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

    # Solo se otorga a ADMIN: los demás roles no tienen acceso a costos.
    role = Role.objects.filter(code="ADMIN").first()
    component = component_by_code.get("costs.management")
    if role and component:
        RoleComponentPermission.objects.update_or_create(
            role=role,
            component=component,
            defaults={"can_view": True, "can_edit": True},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0020_pedidos_customers_access"),
    ]

    operations = [
        migrations.RunPython(sync_costs_component, migrations.RunPython.noop),
    ]
