from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('human_resources', '0010_vacationrequestapprovalstep_signature'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name='HRNotification'),
            ],
            database_operations=[],
        ),
    ]
