from datetime import date

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.employees.infrastructure.models import Employee, EmploymentContract


class EmployeeTerminationTests(TestCase):
    def setUp(self):
        call_command("seed_admin_users", password="InitialPass123!")
        self.client = APIClient()
        self.admin = get_user_model().objects.get(email="admin@juhnios.com")
        self.client.force_authenticate(self.admin)
        self.employee = Employee.objects.create(
            employee_code="EMP-TERMINATION", first_name="Paola", last_name="Test",
            phone="3001234567", status=Employee.Status.ACTIVE,
        )
        self.contract = EmploymentContract.objects.create(
            employee=self.employee, contract_type="INDEFINITE",
            start_date=date(2025, 1, 1), base_salary=2000000,
        )
        self.url = f"/api/v1/employees/{self.employee.id}/"

    def test_termination_keeps_employee_and_related_records_available(self):
        response = self.client.post(self.url + "terminate/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.employee.refresh_from_db()
        self.contract.refresh_from_db()
        self.assertEqual(self.employee.status, Employee.Status.TERMINATED)
        self.assertEqual(self.employee.profile_status, Employee.ProfileStatus.RETIRED)
        self.assertEqual(self.employee.termination_date, timezone.localdate())
        self.assertEqual(self.employee.updated_by, self.admin)
        self.assertIsNone(self.employee.deleted_at)
        self.assertIsNone(self.contract.deleted_at)
        self.assertEqual(self.employee.phone, "3001234567")
        self.assertEqual(self.contract.employee_id, self.employee.id)
        self.assertTrue(self.employee.change_logs.filter(field_name="status").exists())
        self.assertEqual(self.client.get(self.url).status_code, 200)

        history_count = self.employee.change_logs.count()
        self.assertEqual(self.client.post(self.url + "terminate/").status_code, 200)
        self.assertEqual(self.employee.change_logs.count(), history_count)

    def test_delete_is_rejected_without_changing_employee(self):
        self.assertEqual(self.client.delete(self.url).status_code, 405)
        self.employee.refresh_from_db()
        self.assertIsNone(self.employee.deleted_at)
        self.assertEqual(self.employee.status, Employee.Status.ACTIVE)
        self.assertTrue(EmploymentContract.objects.filter(pk=self.contract.pk).exists())

    def test_termination_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url + "terminate/")
        self.assertIn(response.status_code, (401, 403))
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.status, Employee.Status.ACTIVE)
