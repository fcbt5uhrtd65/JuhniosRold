from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.employees.infrastructure.models import Employee


class AdminSeederTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_seed_admin_users_creates_two_admins_with_employee_profiles(self):
        call_command("seed_admin_users", password="InitialPass123!")

        users = get_user_model().objects.filter(
            email__in=("admin@juhnios.com", "administrador2@juhnios.com")
        )
        self.assertEqual(users.count(), 2)
        self.assertTrue(all(user.is_staff for user in users))
        self.assertTrue(all(user.is_superuser for user in users))
        self.assertTrue(all(user.check_password("InitialPass123!") for user in users))
        self.assertEqual(
            Employee.objects.filter(user__in=users, status=Employee.Status.ACTIVE).count(),
            2,
        )

    def test_seed_admin_users_is_idempotent_and_preserves_changed_passwords(self):
        call_command("seed_admin_users", password="InitialPass123!")
        user = get_user_model().objects.get(email="admin@juhnios.com")
        user.set_password("ChangedPass123!")
        user.save(update_fields=("password",))

        call_command("seed_admin_users", password="InitialPass123!")

        self.assertEqual(
            get_user_model().objects.filter(
                email__in=("admin@juhnios.com", "administrador2@juhnios.com")
            ).count(),
            2,
        )
        self.assertEqual(Employee.objects.filter(employee_code__startswith="ADM-").count(), 2)
        user.refresh_from_db()
        self.assertTrue(user.check_password("ChangedPass123!"))

    def test_seed_admin_users_can_reset_existing_passwords_explicitly(self):
        call_command("seed_admin_users", password="InitialPass123!")
        call_command(
            "seed_admin_users",
            password="ResetPass123!",
            reset_passwords=True,
        )

        user = get_user_model().objects.get(email="admin@juhnios.com")
        self.assertTrue(user.check_password("ResetPass123!"))

    def test_employee_and_customer_modules_require_an_administrator(self):
        regular_user = get_user_model().objects.create_user(
            email="cliente@example.com",
            password="CustomerPass123!",
        )
        self.client.force_authenticate(regular_user)

        self.assertEqual(self.client.get("/api/v1/employees/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/customers/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/inventory/stock/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/hr/payroll/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/finance/transactions/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/analytics/dashboard/").status_code, 403)

        call_command("seed_admin_users", password="InitialPass123!")
        admin_user = get_user_model().objects.get(email="admin@juhnios.com")
        self.client.force_authenticate(admin_user)

        self.assertEqual(self.client.get("/api/v1/employees/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/customers/").status_code, 200)
