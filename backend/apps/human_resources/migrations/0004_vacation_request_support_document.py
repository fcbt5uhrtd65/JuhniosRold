from django.core.validators import FileExtensionValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("human_resources", "0003_vacation_request_schedule_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="vacationrequest",
            name="support_document",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="hr/vacations/support/",
                validators=[
                    FileExtensionValidator(allowed_extensions=("pdf", "png", "jpg", "jpeg"))
                ],
            ),
        ),
    ]
