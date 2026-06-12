from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.employees.infrastructure.models import Department, Employee, Position


class EmployeeUserSyncTests(TestCase):
    def setUp(self):
        call_command("seed_admin_users", password="InitialPass123!")
        self.client = APIClient()
        self.admin_user = get_user_model().objects.get(email="admin@juhnios.com")
        self.client.force_authenticate(self.admin_user)

        self.department = Department.objects.create(
            name="Recursos Humanos",
            description="Departamento de RRHH",
        )
        self.position = Position.objects.create(
            department=self.department,
            name="Analista de RRHH",
            description="Gestiona empleados y solicitudes internas",
        )

    def test_create_employee_can_create_associated_user_with_role_and_password(self):
        response = self.client.post(
            "/api/v1/employees/",
            {
                "employee_code": "EMP-900",
                "document_number": "1098765432",
                "first_name": "Laura",
                "last_name": "García",
                "email": "laura.garcia@example.com",
                "phone": "3001234567",
                "address": "Calle 123 #45-67",
                "department": str(self.department.id),
                "position": str(self.position.id),
                "hire_date": "2025-01-15",
                "status": "ACTIVE",
                "user_role": "RRHH",
                "user_password": "SecretPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        employee = Employee.objects.select_related("user", "user__role").get(id=response.data["id"])
        self.assertIsNotNone(employee.user)
        self.assertEqual(employee.user.role.code, "RRHH")
        self.assertTrue(employee.user.check_password("SecretPass123!"))

    def test_update_employee_can_change_user_role_and_password(self):
        employee = Employee.objects.create(
            employee_code="EMP-901",
            document_number="1098765433",
            first_name="Carlos",
            last_name="Pérez",
            email="carlos.perez@example.com",
            phone="3001234568",
            address="Carrera 10 #20-30",
            department=self.department,
            position=self.position,
            hire_date="2025-01-16",
            status=Employee.Status.ACTIVE,
        )

        create_response = self.client.patch(
            f"/api/v1/employees/{employee.id}/",
            {
                "user_role": "EMPLEADO",
                "user_password": "InitialPass123!",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 200)

        employee.refresh_from_db()
        self.assertIsNotNone(employee.user)
        self.assertEqual(employee.user.role.code, "EMPLEADO")
        self.assertTrue(employee.user.check_password("InitialPass123!"))

        update_response = self.client.patch(
            f"/api/v1/employees/{employee.id}/",
            {
                "user_role": "RRHH",
                "user_password": "UpdatedPass123!",
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, 200)
        employee.refresh_from_db()
        self.assertEqual(employee.user.role.code, "RRHH")
        self.assertTrue(employee.user.check_password("UpdatedPass123!"))
