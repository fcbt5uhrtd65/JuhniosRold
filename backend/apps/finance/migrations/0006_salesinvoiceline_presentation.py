from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0005_salesinvoice_cufe"),
    ]

    operations = [
        migrations.AddField(
            model_name="salesinvoiceline",
            name="presentation",
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
