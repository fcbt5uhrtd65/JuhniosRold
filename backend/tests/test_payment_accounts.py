from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.finance.infrastructure.models import PaymentAccount
from apps.identity.infrastructure.models import Role

URL = "/api/v1/finance/payment-accounts/"


def payload(**overrides):
    data = {
        "issue_date": "2026-09-30",
        "service_title": "Servicios de diseño",
        "contractor_name": "Juan Pérez",
        "contractor_document": "1.234.567.890",
        "contractor_document_city": "Bogotá",
        "client_name": "SURTITIENDAS GALVÁN S.A.S.",
        "client_document": "900.271.306-5",
        "description": "Diseño de piezas gráficas",
        "amount": "3500000",
    }
    data.update(overrides)
    return data


class PaymentAccountTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.admin = User.objects.create_superuser(email="adm@example.com", password="x")
        cls.accountant = User.objects.create_user(
            email="cont@example.com", password="x", role=Role.objects.get(code="CONTABILIDAD")
        )
        cls.employee = User.objects.create_user(
            email="emp@example.com", password="x", role=Role.objects.get(code="EMPLEADO")
        )
        cls.client_user = User.objects.create_user(
            email="cli@example.com", password="x", role=Role.objects.get(code="CLIENT")
        )

    def create(self, **overrides):
        return self.client.post(URL, payload(**overrides), format="json")

    # --- permisos ---
    def test_anonymous_is_rejected(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_other_roles_are_forbidden(self):
        for user in (self.employee, self.client_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(URL).status_code, 403)
            self.assertEqual(self.create().status_code, 403)

    def test_admin_and_accounting_can_use_module(self):
        for user in (self.admin, self.accountant):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(URL).status_code, 200)
            self.assertEqual(self.create().status_code, 201)

    def test_no_edit_endpoint(self):
        self.client.force_authenticate(self.admin)
        pk = self.create().data["id"]
        self.assertEqual(self.client.patch(f"{URL}{pk}/", {"amount": "1"}, format="json").status_code, 405)
        self.assertEqual(self.client.put(f"{URL}{pk}/", payload(), format="json").status_code, 405)

    # --- consecutivos ---
    def test_consecutive_never_reused_after_soft_delete(self):
        self.client.force_authenticate(self.admin)
        first = self.create().data
        second = self.create().data
        self.assertEqual((first["id_number"], second["id_number"]), (1, 2))
        self.assertEqual(self.client.delete(f"{URL}{second['id']}/").status_code, 204)
        self.assertTrue(PaymentAccount.all_objects.filter(pk=second["id"], deleted_at__isnull=False).exists())
        self.assertEqual(self.create().data["id_number"], 3)
        self.assertEqual(self.client.get(f"{URL}{second['id']}/").status_code, 404)

    # --- filtros y paginación ---
    def test_filters_and_pagination(self):
        self.client.force_authenticate(self.admin)
        self.create(contractor_name="Ana Gómez", issue_date="2026-08-10")
        self.create(contractor_name="Luis Mora", client_name="Otro Cliente SAS", issue_date="2026-09-10")
        self.create(contractor_name="Luis Mora", issue_date="2026-10-10")

        self.assertEqual(self.client.get(URL, {"id_number": 2}).data["count"], 1)
        self.assertEqual(self.client.get(URL, {"name": "ana gó"}).data["count"], 1)
        self.assertEqual(self.client.get(URL, {"name": "otro cliente"}).data["count"], 1)
        self.assertEqual(self.client.get(URL, {"date_from": "2026-09-01"}).data["count"], 2)
        self.assertEqual(self.client.get(URL, {"date_to": "2026-09-30"}).data["count"], 2)
        self.assertEqual(
            self.client.get(URL, {"date_from": "2026-09-01", "date_to": "2026-09-30"}).data["count"], 1
        )

        page = self.client.get(URL, {"page_size": 2}).data
        self.assertEqual((page["count"], page["page_size"], page["total_pages"], len(page["results"])), (3, 2, 2, 2))
        self.assertEqual(page["results"][0]["id_number"], 3)

    # --- validaciones ---
    def test_invalid_amounts(self):
        self.client.force_authenticate(self.admin)
        for amount in ("0", "-5", "abc"):
            self.assertEqual(self.create(amount=amount).status_code, 400, amount)

    def test_document_validation(self):
        self.client.force_authenticate(self.admin)
        for doc in ("12ab34", "123", "1" * 31):
            self.assertEqual(self.create(contractor_document=doc).status_code, 400, doc)
        self.assertEqual(self.create(contractor_document="12.345-678 90").status_code, 201)

    def test_period_end_before_start(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.create(period_start="2026-09-30", period_end="2026-09-01").status_code, 400)
        self.assertEqual(self.create(period_start="2026-09-01", period_end="2026-09-30").status_code, 201)

    def test_signature_validation(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.create(signature="http://x/y.png").status_code, 400)
        self.assertEqual(self.create(signature="data:image/png;base64," + "A" * 400_000).status_code, 400)
        self.assertEqual(self.create(signature="data:image/png;base64,AAAA").status_code, 201)

    def test_defaults_and_created_by(self):
        self.client.force_authenticate(self.accountant)
        data = self.create().data
        self.assertEqual(data["vat_note"], "No aplica")
        self.assertIsNone(data["monthly_value"])
        self.assertEqual(data["created_by"], self.accountant.pk)
        self.assertEqual(PaymentAccount.objects.get(pk=data["id"]).issue_date, date(2026, 9, 30))

    def test_monthly_value_only_with_certificate(self):
        self.client.force_authenticate(self.admin)
        data = self.create(no_withholding_letter=True, contract_object="Diseño", monthly_value="3000000").data
        self.assertEqual(data["monthly_value"], "3000000.00")
        data = self.create(no_withholding_letter=False, monthly_value="3000000").data
        self.assertIsNone(data["monthly_value"])
