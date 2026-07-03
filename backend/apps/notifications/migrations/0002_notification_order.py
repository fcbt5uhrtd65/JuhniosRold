import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0001_initial"),
        ("commerce", "0009_order_channel"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="notifications",
                to="commerce.order",
            ),
        ),
    ]
