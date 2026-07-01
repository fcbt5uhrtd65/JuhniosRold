from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("identity", "0006_passwordresetcode"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="google_id",
            field=models.CharField(blank=True, db_index=True, max_length=128),
        ),
    ]
