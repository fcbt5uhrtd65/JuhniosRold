from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0004_alter_category_image_url_alter_product_image_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="productvariant",
            name="presentation_number",
            field=models.DecimalField(blank=True, decimal_places=3, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="productvariant",
            name="presentation_unit",
            field=models.CharField(
                blank=True,
                choices=[("ML", "ML"), ("LT", "LT"), ("GR", "GR"), ("KG", "KG"), ("UND", "UND")],
                max_length=3,
            ),
        ),
    ]
