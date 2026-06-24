from django.db import migrations, models


def fill_wholesale_codes(apps, schema_editor):
    Customer = apps.get_model("customers", "Customer")
    for customer in Customer.objects.filter(wholesale_code=""):
        seed = customer.document_number or customer.email or str(customer.id)
        clean = "".join(ch for ch in seed.upper() if ch.isalnum())[:8] or str(customer.id).replace("-", "")[:8].upper()
        customer.wholesale_code = f"JR-MAY-{clean}"
        customer.save(update_fields=["wholesale_code"])


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0003_customeraddress"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="purchase_mode",
            field=models.CharField(
                choices=[("RETAIL", "Compra personal / minorista"), ("WHOLESALE", "Compra mayorista")],
                default="RETAIL",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="customer",
            name="wholesale_code",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.RunPython(fill_wholesale_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="customer",
            name="wholesale_code",
            field=models.CharField(blank=True, max_length=40, unique=True),
        ),
    ]
