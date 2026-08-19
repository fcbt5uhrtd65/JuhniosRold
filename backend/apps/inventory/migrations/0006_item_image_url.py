from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_item_product_variant"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="image_url",
            field=models.TextField(blank=True),
        ),
    ]
