from decimal import Decimal
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch

from apps.customers.infrastructure.models import Customer, CustomerAddress
from apps.identity.infrastructure.models import EmailVerificationCode


class IdentityApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_login_and_profile_contract(self):
        with (
            patch(
                "apps.identity.infrastructure.serializers.EmailVerificationCode.generate_code",
                return_value="123456",
            ),
            patch(
                "apps.identity.infrastructure.serializers.send_registration_verification_email.delay"
            ) as send_code,
        ):
            register_response = self.client.post(
                "/api/v1/auth/register/",
                {
                    "email": "cliente@example.com",
                    "password": "password-seguro",
                    "first_name": "Cliente",
                    "last_name": "Prueba",
                    "phone": "3001234567",
                    "address": "Calle 100 # 15-20",
                    "city": "Bogotá",
                    "state": "Bogotá D.C.",
                    "country": "Colombia",
                    "latitude": 4.711,
                    "longitude": -74.0721,
                },
                format="json",
            )
        self.assertEqual(register_response.status_code, 202)
        self.assertIn("verification_id", register_response.data)
        send_code.assert_called_once_with("cliente@example.com", "123456")
        self.assertFalse(Customer.objects.filter(email="cliente@example.com").exists())

        verify_response = self.client.post(
            "/api/v1/auth/register/verify/",
            {
                "verification_id": register_response.data["verification_id"],
                "code": "123456",
            },
            format="json",
        )
        self.assertEqual(verify_response.status_code, 201)
        self.assertEqual(verify_response.data["user"]["email"], "cliente@example.com")
        self.assertEqual(verify_response.data["user"]["role"], "CLIENT")
        self.assertIn("access", verify_response.data)
        self.assertIn("refresh", verify_response.data)

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
        self.assertTrue(
            CustomerAddress.objects.filter(
                customer__email="cliente@example.com",
                latitude=Decimal("4.711000"),
                longitude=Decimal("-74.072100"),
                is_default=True,
            ).exists()
        )

    def test_registration_without_location_does_not_create_address(self):
        with (
            patch(
                "apps.identity.infrastructure.serializers.EmailVerificationCode.generate_code",
                return_value="222333",
            ),
            patch(
                "apps.identity.infrastructure.serializers.send_registration_verification_email.delay"
            ),
        ):
            register_response = self.client.post(
                "/api/v1/auth/register/",
                {
                    "email": "sinubicacion@example.com",
                    "password": "password-seguro",
                    "first_name": "Sin",
                    "last_name": "Ubicacion",
                },
                format="json",
            )
        self.assertEqual(register_response.status_code, 202)

        verify_response = self.client.post(
            "/api/v1/auth/register/verify/",
            {
                "verification_id": register_response.data["verification_id"],
                "code": "222333",
            },
            format="json",
        )
        self.assertEqual(verify_response.status_code, 201)
        self.assertTrue(
            Customer.objects.filter(email="sinubicacion@example.com").exists()
        )
        self.assertFalse(
            CustomerAddress.objects.filter(
                customer__email="sinubicacion@example.com"
            ).exists()
        )

    def test_registration_rejects_latitude_without_longitude(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "email": "coordenadasincompletas@example.com",
                "password": "password-seguro",
                "first_name": "Cliente",
                "last_name": "Prueba",
                "latitude": 4.711,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude", response.data)

    def test_registration_rejects_existing_customer_document_number(self):
        Customer.objects.create(
            document_type="CC",
            document_number="1041771426",
            first_name="Armando",
            last_name="Perez",
            email="armando@example.com",
        )

        with patch(
            "apps.identity.infrastructure.serializers.send_registration_verification_email.delay"
        ) as send_code:
            response = self.client.post(
                "/api/v1/auth/register/",
                {
                    "email": "nuevo@example.com",
                    "password": "password-seguro",
                    "first_name": "Nuevo",
                    "last_name": "Cliente",
                    "document_type": "CC",
                    "document_number": "1041771426",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("document_number", response.data)
        send_code.assert_not_called()

    def test_verify_pending_registration_with_duplicate_document_returns_400(self):
        Customer.objects.create(
            document_type="CC",
            document_number="1041771426",
            first_name="Armando",
            last_name="Perez",
            email="armando@example.com",
        )
        code = "123456"
        registration = EmailVerificationCode.objects.create(
            email="nuevo@example.com",
            registration_data={
                "email": "nuevo@example.com",
                "first_name": "Nuevo",
                "last_name": "Cliente",
                "document_type": "CC",
                "document_number": "1041771426",
            },
            password_hash=make_password("password-seguro"),
            code_hash=EmailVerificationCode.hash_code(code),
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        response = self.client.post(
            "/api/v1/auth/register/verify/",
            {"verification_id": registration.id, "code": code},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("document_number", response.data)
        registration.refresh_from_db()
        self.assertIsNone(registration.used_at)

    def test_verify_pending_registration_without_names_returns_400(self):
        code = "123456"
        registration = EmailVerificationCode.objects.create(
            email="sinnombre@example.com",
            registration_data={
                "email": "sinnombre@example.com",
                "first_name": "",
                "last_name": "",
            },
            password_hash=make_password("password-seguro"),
            code_hash=EmailVerificationCode.hash_code(code),
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        response = self.client.post(
            "/api/v1/auth/register/verify/",
            {"verification_id": registration.id, "code": code},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("first_name", response.data)
        self.assertFalse(Customer.objects.filter(email="sinnombre@example.com").exists())

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

    def test_password_reset_requires_code_before_changing_password(self):
        with patch(
            "apps.identity.infrastructure.serializers.EmailVerificationCode.generate_code",
            return_value="111222",
        ):
            self.client.post(
                "/api/v1/auth/register/",
                {
                    "email": "reset@example.com",
                    "password": "password-viejo",
                    "first_name": "Reset",
                    "last_name": "Cliente",
                },
                format="json",
            )
        from apps.identity.infrastructure.models import EmailVerificationCode

        registration = EmailVerificationCode.objects.get(email="reset@example.com")
        verify_registration = self.client.post(
            "/api/v1/auth/register/verify/",
            {"verification_id": registration.id, "code": "111222"},
            format="json",
        )
        self.assertEqual(verify_registration.status_code, 201)

        with (
            patch(
                "apps.identity.infrastructure.serializers.PasswordResetCode.generate_code",
                return_value="654321",
            ),
            patch(
                "apps.identity.infrastructure.serializers.send_password_reset_code_email.delay"
            ) as send_code,
        ):
            request_response = self.client.post(
                "/api/v1/auth/password-reset/",
                {"email": "reset@example.com"},
                format="json",
            )
        self.assertEqual(request_response.status_code, 202)
        self.assertIn("verification_id", request_response.data)
        send_code.assert_called_once_with("reset@example.com", "654321")

        verify_response = self.client.post(
            "/api/v1/auth/password-reset/verify/",
            {
                "verification_id": request_response.data["verification_id"],
                "code": "654321",
            },
            format="json",
        )
        self.assertEqual(verify_response.status_code, 200)
        self.assertIn("reset_token", verify_response.data)

        confirm_response = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "token": verify_response.data["reset_token"],
                "new_password": "password-nuevo",
            },
            format="json",
        )
        self.assertEqual(confirm_response.status_code, 200)

        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "reset@example.com", "password": "password-nuevo"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
