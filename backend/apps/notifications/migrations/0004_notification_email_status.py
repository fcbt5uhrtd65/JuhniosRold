from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0003_staff_notification"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="email_status",
            field=models.CharField(
                blank=True,
                choices=[("PENDING", "En cola"), ("SENT", "Enviado"), ("FAILED", "Error al enviar")],
                default="",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="email_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="notification",
            name="email_error",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
    ]
