import hashlib
import uuid

from django.db import migrations, models


def populate_cufe(apps, schema_editor):
    SalesInvoice = apps.get_model("finance", "SalesInvoice")
    company_nit = "900452638-2"
    for invoice in SalesInvoice.objects.filter(cufe=""):
        seed = f"{invoice.number}{invoice.total}{invoice.issued_at.isoformat()}{company_nit}{uuid.uuid4().hex}"
        invoice.cufe = hashlib.sha256(seed.encode("utf-8")).hexdigest()
        invoice.save(update_fields=["cufe"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0004_salesinvoice_dian_resolution_salesinvoice_tax_rate'),
    ]

    operations = [
        migrations.AddField(
            model_name='salesinvoice',
            name='cufe',
            field=models.CharField(blank=True, editable=False, help_text='Código único de verificación de la factura, usado como contenido del QR.', max_length=96, default=""),
            preserve_default=False,
        ),
        migrations.RunPython(populate_cufe, noop),
        migrations.AlterField(
            model_name='salesinvoice',
            name='cufe',
            field=models.CharField(blank=True, editable=False, help_text='Código único de verificación de la factura, usado como contenido del QR.', max_length=96, unique=True),
        ),
    ]
