import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("customers", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReferralCode",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("code", models.CharField(blank=True, max_length=20, unique=True)),
                (
                    "customer",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="referral_code",
                        to="customers.customer",
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="ReferralRedemption",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("status", models.CharField(
                    choices=[
                        ("PENDING", "Pendiente"),
                        ("VALIDATED", "Validado"),
                        ("REWARDED", "Recompensado"),
                        ("REJECTED", "Rechazado"),
                    ],
                    default="PENDING",
                    max_length=20,
                )),
                ("redeemed_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("validated_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "referral_code",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="redemptions",
                        to="referrals.referralcode",
                    ),
                ),
                (
                    "referred_customer",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="referral_redemption",
                        to="customers.customer",
                    ),
                ),
                (
                    "referrer_customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="referrals_made",
                        to="customers.customer",
                    ),
                ),
            ],
            options={
                "ordering": ("-redeemed_at",),
                "abstract": False,
            },
        ),
    ]
