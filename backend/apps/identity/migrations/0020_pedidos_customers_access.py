from django.db import migrations


def grant_pedidos_customers_view(apps, schema_editor):
    """Give the PEDIDOS role read-only access to the customers module."""
    Role = apps.get_model("identity", "Role")
    Component = apps.get_model("identity", "Component")
    RoleComponentPermission = apps.get_model("identity", "RoleComponentPermission")

    role = Role.objects.filter(code="PEDIDOS").first()
    component = Component.objects.filter(code="customers.management").first()
    if not role or not component:
        return
    RoleComponentPermission.objects.update_or_create(
        role=role,
        component=component,
        defaults={"can_view": True, "can_edit": False},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0019_sync_payment_accounts_component"),
    ]

    operations = [
        migrations.RunPython(grant_pedidos_customers_view, migrations.RunPython.noop),
    ]
