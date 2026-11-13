from django.db import migrations, models


def backfill(apps, schema_editor):
    PaymentAccount = apps.get_model("finance", "PaymentAccount")
    counters = {}
    for account in PaymentAccount._base_manager.order_by("number"):
        key = "".join(ch for ch in (account.contractor_document or "") if ch.isdigit())
        counters[key] = counters.get(key, 0) + 1
        PaymentAccount._base_manager.filter(pk=account.pk).update(
            contractor_document_key=key, contractor_number=counters[key]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0008_paymentaccount"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentaccount",
            name="contractor_number",
            field=models.PositiveIntegerField(default=1, editable=False),
        ),
        migrations.AddField(
            model_name="paymentaccount",
            name="contractor_document_key",
            field=models.CharField(blank=True, db_index=True, default="", editable=False, max_length=30),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
