import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0007_alter_order_status_and_history_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="discount_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="order",
            name="wholesale_code",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="presentation",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.CreateModel(
            name="WholesaleSettings",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("minimum_purchase", models.DecimalField(decimal_places=2, default=300000, max_digits=14)),
                ("discount_percentage", models.DecimalField(decimal_places=2, default=10, max_digits=5)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Configuracion mayorista",
                "verbose_name_plural": "Configuracion mayorista",
            },
        ),
    ]
