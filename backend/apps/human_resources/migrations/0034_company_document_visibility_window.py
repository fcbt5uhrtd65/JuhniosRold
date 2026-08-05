from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("human_resources", "0033_company_document"),
    ]

    operations = [
        migrations.AddField(
            model_name="companydocument",
            name="visible_from",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="companydocument",
            name="visible_until",
            field=models.DateField(blank=True, null=True),
        ),
    ]
