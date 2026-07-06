import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.employees.infrastructure.models import Department, Employee, Position
from apps.identity.infrastructure.models import Role, User


DEFAULT_ADMIN_PASSWORD = "Admin123!"
ADMIN_USERS = (
    {
        "email": "admin@juhnios.com",
        "first_name": "Administrador",
        "last_name": "Principal",
        "employee_code": "ADM-001",
        "document_number": "SEED-ADMIN-001",
    },
    {
        "email": "administrador2@juhnios.com",
        "first_name": "Administrador",
        "last_name": "Secundario",
        "employee_code": "ADM-002",
        "document_number": "SEED-ADMIN-002",
    },
)


@transaction.atomic
def seed_admin_users(password, reset_passwords=False):
    admin_role, _ = Role.all_objects.update_or_create(
        code="ADMIN",
        defaults={
            "name": "Administrador",
            "description": "Acceso total al sistema.",
            "is_superuser": True,
            "is_default": False,
            "is_active": True,
            "deleted_at": None,
        },
    )
    department, _ = Department.all_objects.update_or_create(
        name="Administracion",
        defaults={
            "description": "Direccion y administracion general.",
            "is_active": True,
            "deleted_at": None,
        },
    )
    position, _ = Position.all_objects.update_or_create(
        department=department,
        name="Administrador del sistema",
        defaults={
            "description": "Administracion integral de la plataforma.",
            "is_active": True,
            "deleted_at": None,
        },
    )

    created_users = 0
    updated_users = 0
    for admin_data in ADMIN_USERS:
        user, created = User.objects.get_or_create(
            email=admin_data["email"],
            defaults={
                "first_name": admin_data["first_name"],
                "last_name": admin_data["last_name"],
                "is_active": True,
                "role": admin_role,
            },
        )
        user.first_name = admin_data["first_name"]
        user.last_name = admin_data["last_name"]
        user.is_active = True
        user.role = admin_role
        user.deleted_at = None
        if created or reset_passwords:
            user.set_password(password)
        user.save()

        employee = Employee.all_objects.filter(user=user).first()
        if employee is None:
            employee = Employee.all_objects.filter(
                employee_code=admin_data["employee_code"]
            ).first()
        if employee is None:
            employee = Employee(user=user)

        employee.user = user
        employee.employee_code = admin_data["employee_code"]
        employee.document_number = admin_data["document_number"]
        employee.first_name = admin_data["first_name"]
        employee.last_name = admin_data["last_name"]
        employee.email = admin_data["email"]
        employee.department = department
        employee.position = position
        employee.hire_date = employee.hire_date or timezone.localdate()
        employee.status = Employee.Status.ACTIVE
        employee.deleted_at = None
        employee.save()

        if created:
            created_users += 1
        else:
            updated_users += 1

    return created_users, updated_users


class Command(BaseCommand):
    help = "Crea o actualiza las dos cuentas administrativas iniciales."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            help="Contrasena inicial. Por defecto usa ADMIN_SEED_PASSWORD.",
        )
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Restablece la contrasena incluso si las cuentas ya existen.",
        )

    def handle(self, *args, **options):
        password = options["password"] or os.getenv("ADMIN_SEED_PASSWORD")
        if not password:
            if not settings.DEBUG:
                raise CommandError(
                    "Debe proveerse --password o ADMIN_SEED_PASSWORD; "
                    "no se permite la contraseña por defecto fuera de DEBUG."
                )
            password = DEFAULT_ADMIN_PASSWORD
        created, updated = seed_admin_users(
            password=password,
            reset_passwords=options["reset_passwords"],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Administradores listos: {created} creados, {updated} actualizados."
            )
        )
