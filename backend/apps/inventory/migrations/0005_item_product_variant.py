import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0011_flipbookcatalog'),
        ('inventory', '0004_alter_stock_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='product_variant',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inventory_items',
                to='catalog.productvariant',
            ),
        ),
    ]
