from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0008_wholesale_discount_and_presentation"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="channel",
            field=models.CharField(
                choices=[("ONLINE", "Venta virtual"), ("IN_STORE", "Venta presencial")],
                default="ONLINE",
                max_length=20,
            ),
        ),
    ]
