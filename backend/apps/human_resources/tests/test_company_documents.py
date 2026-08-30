from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.employees.infrastructure.models import Branch, Department, Employee, Position
from apps.human_resources.infrastructure.models import CompanyDocument, CompanyDocumentVersion
from apps.identity.infrastructure.models import Role


class CompanyDocumentVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        role = Role.objects.get(code="EMPLEADO")
        department = Department.objects.create(name="Operaciones")
        position = Position.objects.create(department=department, name="Auxiliar")
        self.branch_a = Branch.objects.create(code="A", name="Sede A")
        self.branch_b = Branch.objects.create(code="B", name="Sede B")
        self.user = get_user_model().objects.create_user(
            email="empleado-docs@example.com",
            password="SecurePass123!",
            role=role,
        )
        Employee.objects.create(
            user=self.user,
            employee_code="EMP-DOC-1",
            document_number="123456789",
            first_name="Empleado",
            last_name="Docs",
            email="empleado-docs@example.com",
            department=department,
            position=position,
            branch=self.branch_a,
            hire_date="2026-01-01",
            status=Employee.Status.ACTIVE,
        )
        self.client.force_authenticate(self.user)

    def _publish_document(self, name, category="REGULATION", branches=None):
        document = CompanyDocument.objects.create(category=category, name=name)
        if branches:
            document.branches.set(branches)
        CompanyDocumentVersion.objects.create(
            document=document,
            version_number=1,
            file=SimpleUploadedFile("documento.pdf", b"%PDF-1.4\n", content_type="application/pdf"),
        )
        return document

    @staticmethod
    def _results(response):
        data = response.data
        return data["results"] if isinstance(data, dict) and "results" in data else data

    def test_employee_only_sees_global_documents_and_documents_for_their_branch(self):
        self._publish_document("Reglamento global")
        self._publish_document("Reglamento sede A", branches=[self.branch_a])
        self._publish_document("Reglamento sede B", branches=[self.branch_b])
        self._publish_document("Politica sede A", category="POLICY", branches=[self.branch_a])

        response = self.client.get("/api/v1/hr/company-documents/?category=REGULATION")

        self.assertEqual(response.status_code, 200)
        names = {item["name"] for item in self._results(response)}
        self.assertEqual(names, {"Reglamento global", "Reglamento sede A"})

    def test_branch_filter_applies_to_any_company_document_category(self):
        self._publish_document("Politica sede A", category="POLICY", branches=[self.branch_a])
        self._publish_document("Politica sede B", category="POLICY", branches=[self.branch_b])

        response = self.client.get("/api/v1/hr/company-documents/?category=POLICY")

        self.assertEqual(response.status_code, 200)
        names = {item["name"] for item in self._results(response)}
        self.assertEqual(names, {"Politica sede A"})
