from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("human_resources", "0041_vacationrequest_loan_deduction_schedule"),
    ]

    operations = [
        migrations.AddField(
            model_name="payslipdocument",
            name="viewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
