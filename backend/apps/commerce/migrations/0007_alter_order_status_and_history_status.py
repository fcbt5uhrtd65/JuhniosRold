from django.db import migrations, models


ORDER_STATUS_CHOICES = [
    ("PENDING", "Pendiente"),
    ("PAYMENT_PENDING", "En pago"),
    ("PAID", "Pagado"),
    ("FAILED", "Fallido"),
    ("CONFIRMED", "Confirmado"),
    ("PROCESSING", "En preparación"),
    ("PACKED", "Empacado"),
    ("SHIPPED", "Despachado"),
    ("IN_TRANSIT", "En camino"),
    ("DELIVERED", "Entregado"),
    ("CANCELLED", "Cancelado"),
    ("RETURNED", "Devuelto"),
]


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0006_order_restored_cart"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=ORDER_STATUS_CHOICES,
                default="PENDING",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="orderstatushistory",
            name="status",
            field=models.CharField(choices=ORDER_STATUS_CHOICES, max_length=20),
        ),
    ]
