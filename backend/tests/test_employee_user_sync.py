from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.employees.infrastructure.models import Department, Employee, Position
from apps.identity.infrastructure.models import Role


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

    def test_employee_self_service_updates_allowed_data_and_access_password_only(self):
        employee_user = get_user_model().objects.create_user(
            email="empleada@example.com",
            password="InitialPass123!",
            first_name="Marta",
            last_name="Lopez",
            role=Role.objects.get(code="EMPLEADO"),
        )
        employee = Employee.objects.create(
            user=employee_user,
            employee_code="EMP-902",
            document_number="1098765434",
            first_name="Marta",
            last_name="Lopez",
            email="empleada@example.com",
            phone="3001234569",
            address="Calle 1 #2-3",
            department=self.department,
            position=self.position,
            hire_date="2025-01-17",
            status=Employee.Status.ACTIVE,
            base_salary=1500000,
            access_password="InitialPass123!",
        )

        self.client.force_authenticate(employee_user)
        response = self.client.patch(
            "/api/v1/employees/me/",
            {
                "phone": "3112223344",
                "eps": "Nueva EPS",
                "bank_name": "Bancolombia",
                "bank_account_type": "SAVINGS",
                "bank_account_number": "123456789",
                "emergency_contact_name": "Ana Lopez",
                "emergency_contact_relationship": "Hermana",
                "emergency_contact_mobile": "3000000000",
                "base_salary": "9999999",
                "current_password": "InitialPass123!",
                "user_password": "UpdatedPass123!",
                "user_password_confirm": "UpdatedPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        employee.refresh_from_db()
        employee_user.refresh_from_db()
        self.assertEqual(employee.phone, "3112223344")
        self.assertEqual(employee.eps, "Nueva EPS")
        self.assertEqual(employee.bank_name, "Bancolombia")
        self.assertEqual(employee.emergency_contact_name, "Ana Lopez")
        self.assertEqual(str(employee.base_salary), "1500000.00")
        self.assertEqual(employee.access_password, "UpdatedPass123!")
        self.assertTrue(employee_user.check_password("UpdatedPass123!"))
