from django.test import TestCase
from rest_framework.test import APIClient

from apps.customers.infrastructure.models import Customer


class IdentityApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_login_and_profile_contract(self):
        register_response = self.client.post(
            "/api/v1/auth/register/",
            {
                "email": "cliente@example.com",
                "password": "password-seguro",
                "first_name": "Cliente",
                "last_name": "Prueba",
                "phone": "3001234567",
            },
            format="json",
        )
        self.assertEqual(register_response.status_code, 201)
        self.assertEqual(register_response.data["email"], "cliente@example.com")
        self.assertEqual(register_response.data["role"], "CLIENT")

        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "cliente@example.com", "password": "password-seguro"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertIn("access", login_response.data)
        self.assertIn("refresh", login_response.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        profile_response = self.client.get("/api/v1/auth/users/me/")

        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data["email"], "cliente@example.com")
        self.assertEqual(profile_response.data["phone"], "3001234567")
        self.assertEqual(profile_response.data["role"], "CLIENT")
        self.assertTrue(
            Customer.objects.filter(
                user__email="cliente@example.com",
                email="cliente@example.com",
            ).exists()
        )

    def test_invalid_registration_does_not_create_local_or_database_customer(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "email": "invalido@example.com",
                "password": "123",
                "first_name": "Cliente",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            Customer.objects.filter(email="invalido@example.com").exists()
        )
