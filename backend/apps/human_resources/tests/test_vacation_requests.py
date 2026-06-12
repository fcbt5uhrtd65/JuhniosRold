from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.employees.infrastructure.models import Department, Employee, Position
from apps.identity.infrastructure.models import Role


class VacationRequestPortalTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(
            code="EMPLEADO",
            defaults={
                "name": "Empleado",
                "description": "Rol para empleados internos.",
                "is_superuser": False,
                "is_default": False,
                "is_active": True,
            },
        )
        self.department = Department.objects.create(
            name="Operaciones",
            description="Departamento operativo",
        )
        self.position = Position.objects.create(
            department=self.department,
            name="Auxiliar operativo",
            description="Soporte operativo interno",
        )
        self.user = get_user_model().objects.create_user(
            email="empleado@example.com",
            password="SecurePass123!",
            first_name="Ana",
            last_name="Pérez",
            role=self.role,
        )
        self.employee = Employee.objects.create(
            user=self.user,
            employee_code="EMP-100",
            document_number="1234567890",
            first_name="Ana",
            last_name="Pérez",
            email="empleado@example.com",
            phone="3001234567",
            address="Calle 123 #45-67",
            department=self.department,
            position=self.position,
            hire_date="2025-01-10",
            status=Employee.Status.ACTIVE,
        )
        self.client.force_authenticate(self.user)

    def test_employee_can_create_single_day_permission_without_employee_field(self):
        response = self.client.post(
            "/api/v1/hr/vacations/me/",
            {
                "request_type": "PERMISSION",
                "start_date": "2026-07-02",
                "end_date": "2026-07-02",
                "is_full_day": False,
                "start_time": "12:00",
                "reason": "Asuntos familiares",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["request_type"], "PERMISSION")
        self.assertFalse(response.data["is_full_day"])
        self.assertEqual(response.data["start_time"], "12:00:00")
        self.assertEqual(str(response.data["employee"]), str(self.employee.id))

    def test_employee_can_create_multi_day_vacation_with_daily_time_range(self):
        response = self.client.post(
            "/api/v1/hr/vacations/me/",
            {
                "request_type": "VACATION",
                "start_date": "2026-07-04",
                "end_date": "2026-07-20",
                "is_full_day": False,
                "start_time": "08:00",
                "end_time": "11:00",
                "reason": "Clases de conducción",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["request_type"], "VACATION")
        self.assertFalse(response.data["is_full_day"])
        self.assertEqual(response.data["start_time"], "08:00:00")
        self.assertEqual(response.data["end_time"], "11:00:00")
