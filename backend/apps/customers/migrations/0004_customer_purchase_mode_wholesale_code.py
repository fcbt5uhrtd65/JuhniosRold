from django.db import migrations, models


def fill_wholesale_codes(apps, schema_editor):
    Customer = apps.get_model("customers", "Customer")
    used = set(Customer.objects.exclude(wholesale_code="").values_list("wholesale_code", flat=True))
    for customer in Customer.objects.filter(wholesale_code="").order_by("id"):
        seed = customer.document_number or customer.email or ""
        clean = "".join(ch for ch in seed.upper() if ch.isalnum())[:8]
        if not clean:
            clean = str(customer.id).replace("-", "")[:8].upper()
        base = f"JR-MAY-{clean}"
        code = base
        suffix = 1
        while code in used:
            code = f"{base}-{suffix}"
            suffix += 1
        used.add(code)
        customer.wholesale_code = code
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
