import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("commerce", "0009_order_channel"),
        ("employees", "0013_employee_is_salesperson"),
        ("promotions", "0002_seller_discount_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="seller",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="seller_orders",
                to="employees.employee",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="seller_discount_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="order",
            name="seller_discount_code",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="orders",
                to="promotions.sellerdiscountcode",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="seller_discount_code_text",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="order",
            name="seller_name",
            field=models.CharField(blank=True, max_length=180),
        ),
        migrations.CreateModel(
            name="SellerDiscountRedemption",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("code_text", models.CharField(max_length=40)),
                ("discount_amount", models.DecimalField(decimal_places=2, max_digits=14)),
                (
                    "code",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="redemptions",
                        to="promotions.sellerdiscountcode",
                    ),
                ),
                (
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="seller_discount_redemptions",
                        to="customers.customer",
                    ),
                ),
                (
                    "order",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="seller_discount_redemption",
                        to="commerce.order",
                    ),
                ),
                (
                    "seller",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="discount_redemptions",
                        to="employees.employee",
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
    ]
