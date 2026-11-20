from django.db import migrations

from apps.identity.access_control import COMPONENT_DEFINITIONS

COMPONENT_CODE = "human_resources.payslip_upload"


def sync_payslip_upload_component(apps, schema_editor):
    """Crea el componente de carga de volantes y se lo otorga a Seguridad y salud
    (subir y ver su historial; sin editar ni eliminar)."""
    Role = apps.get_model("identity", "Role")
    Component = apps.get_model("identity", "Component")
    RoleComponentPermission = apps.get_model("identity", "RoleComponentPermission")

    component_def = next(c for c in COMPONENT_DEFINITIONS if c["code"] == COMPONENT_CODE)
    component, _ = Component.objects.update_or_create(
        code=COMPONENT_CODE,
        defaults={
            "name": component_def["name"],
            "description": component_def["description"],
            "is_active": True,
            "deleted_at": None,
        },
    )
    for role_code in ("ADMIN", "SEGURIDAD_SALUD"):
        role = Role.objects.filter(code=role_code).first()
        if role:
            RoleComponentPermission.objects.update_or_create(
                role=role,
                component=component,
                defaults={"can_view": True, "can_edit": True},
            )


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0022_sync_seguridad_salud_role"),
    ]

    operations = [
        migrations.RunPython(sync_payslip_upload_component, migrations.RunPython.noop),
    ]
