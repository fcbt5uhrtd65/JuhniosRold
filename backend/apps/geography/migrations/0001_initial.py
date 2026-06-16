from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Country",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("iso_code", models.CharField(max_length=3, unique=True)),
                ("phone_code", models.CharField(blank=True, max_length=10)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "País",
                "verbose_name_plural": "Países",
                "ordering": ("name",),
            },
        ),
        migrations.CreateModel(
            name="State",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("code", models.CharField(blank=True, max_length=10)),
                ("is_active", models.BooleanField(default=True)),
                ("country", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="states", to="geography.country")),
            ],
            options={
                "verbose_name": "Departamento / Estado",
                "verbose_name_plural": "Departamentos / Estados",
                "ordering": ("name",),
                "unique_together": {("country", "name")},
            },
        ),
        migrations.CreateModel(
            name="City",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("is_active", models.BooleanField(default=True)),
                ("country", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cities", to="geography.country")),
                ("state", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cities", to="geography.state")),
            ],
            options={
                "verbose_name": "Ciudad / Municipio",
                "verbose_name_plural": "Ciudades / Municipios",
                "ordering": ("name",),
                "unique_together": {("state", "name")},
            },
        ),
    ]
