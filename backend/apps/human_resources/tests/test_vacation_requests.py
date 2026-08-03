import io

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from pypdf import PdfReader, PdfWriter
from rest_framework.test import APIClient

from apps.employees.infrastructure.models import Department, Employee, Position
from apps.human_resources.infrastructure.models import VacationRequest, VacationRequestApprovalStep
from apps.human_resources.infrastructure.request_pdf import _parse_runs, render_request_pdf
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

    def test_employee_can_attach_pdf_support_document(self):
        support_file = SimpleUploadedFile(
            "certificado.pdf",
            b"%PDF-1.4\n%test\n",
            content_type="application/pdf",
        )

        response = self.client.post(
            "/api/v1/hr/vacations/me/",
            {
                "request_type": "PERMISSION",
                "start_date": "2026-07-02",
                "end_date": "2026-07-02",
                "is_full_day": False,
                "start_time": "12:00",
                "reason": "Cita medica",
                "support_document": support_file,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn("support_document", response.data)
        self.assertIn("certificado.pdf", response.data["support_document"])

    def test_employee_cannot_attach_unsupported_support_document(self):
        support_file = SimpleUploadedFile(
            "justificante.txt",
            b"texto invalido",
            content_type="text/plain",
        )

        response = self.client.post(
            "/api/v1/hr/vacations/me/",
            {
                "request_type": "PERMISSION",
                "start_date": "2026-07-02",
                "end_date": "2026-07-02",
                "is_full_day": False,
                "start_time": "12:00",
                "reason": "Asuntos familiares",
                "support_document": support_file,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("support_document", response.data)

    def test_request_pdf_sanitizes_reason_whitespace_and_leaves_signature_area_blank(self):
        vacation = VacationRequest.objects.create(
            employee=self.employee,
            request_type=VacationRequest.RequestType.PERMISSION,
            start_date="2026-07-27",
            end_date="2026-07-27",
            is_full_day=False,
            reason="Buenas tardes,\r\n\r\nPor medio de la presente,\tAgradezco su comprension.",
        )

        tokens = _parse_runs([(f"“{vacation.reason}”", False)])
        self.assertNotIn("\r", "".join(token for token, _ in tokens))
        self.assertNotIn("\n", "".join(token for token, _ in tokens))
        self.assertNotIn("\t", "".join(token for token, _ in tokens))
        boundary_tokens = _parse_runs([("solicitud de", False), (" Permiso ", True), ("identificada", False)])
        self.assertEqual(" ".join(token for token, _ in boundary_tokens), "solicitud de Permiso identificada")

        pdf_buffer = render_request_pdf(vacation)
        text = "\n".join(page.extract_text() or "" for page in PdfReader(pdf_buffer).pages)

        self.assertIn("Firmas de aprob", text)
        self.assertNotIn("firmas registradas", text)

    def test_loan_request_pdf_wraps_long_requester_name_without_ellipsis(self):
        requester_name = "Leonardo Fabio Mendoza Castillo Supervisor Principal De Produccion"
        vacation = VacationRequest.objects.create(
            employee=self.employee,
            request_type=VacationRequest.RequestType.LOAN,
            start_date="2026-08-03",
            end_date="2026-08-03",
            is_full_day=True,
            loan_amount="500",
            loan_requester_name=requester_name,
            loan_requester_document="72294048",
            loan_city="Barranquilla",
            loan_position="Operario de maquina",
            loan_concept="Negocio",
            loan_frequency="BIWEEKLY",
            loan_installments_count=10,
            loan_expense_number="EGR-202608-0001",
        )

        pdf_buffer = render_request_pdf(vacation)
        text = "\n".join(page.extract_text() or "" for page in PdfReader(pdf_buffer).pages)
        normalized_text = " ".join(text.split())

        self.assertNotIn("...", text)
        self.assertIn(requester_name, normalized_text)

    def test_request_pdf_appends_pdf_support_document_as_extra_page(self):
        support_buffer = io.BytesIO()
        support_writer = PdfWriter()
        support_writer.add_blank_page(width=72, height=72)
        support_writer.write(support_buffer)
        support_buffer.seek(0)
        support_file = SimpleUploadedFile(
            "soporte.pdf",
            support_buffer.read(),
            content_type="application/pdf",
        )
        vacation = VacationRequest.objects.create(
            employee=self.employee,
            request_type=VacationRequest.RequestType.PERMISSION,
            start_date="2026-07-27",
            end_date="2026-07-27",
            is_full_day=False,
            reason="Cita medica",
            support_document=support_file,
        )

        pdf_buffer = render_request_pdf(vacation)
        reader = PdfReader(pdf_buffer)

        self.assertGreaterEqual(len(reader.pages), 2)

    def test_treasury_approval_finalizes_loan_without_admin_step(self):
        loan_signature = SimpleUploadedFile(
            "solicitante.png",
            b"fake-signature",
            content_type="image/png",
        )
        create_response = self.client.post(
            "/api/v1/hr/vacations/me/",
            {
                "request_type": "LOAN",
                "start_date": "2026-07-29",
                "end_date": "2026-07-29",
                "is_full_day": True,
                "loan_amount": "500000",
                "loan_requester_name": "Ana Perez",
                "loan_requester_document": "1234567890",
                "loan_city": "Bogota",
                "loan_position": "Auxiliar operativo",
                "loan_concept": "Calamidad domestica",
                "loan_frequency": "BIWEEKLY",
                "loan_installments_count": "4",
                "loan_requester_signature": loan_signature,
            },
            format="multipart",
        )

        self.assertEqual(create_response.status_code, 201)
        loan_id = create_response.data["id"]
        self.assertEqual(
            set(
                VacationRequestApprovalStep.objects.filter(request_id=loan_id)
                .values_list("step", flat=True)
            ),
            {"REQUESTER", "HR"},
        )

        treasurer = get_user_model().objects.create_user(
            email="tesoreria@example.com",
            password="SecurePass123!",
            role=Role.objects.get(code="TESORERIA"),
        )
        self.client.force_authenticate(treasurer)
        treasury_signature = SimpleUploadedFile(
            "tesoreria.png",
            b"fake-signature",
            content_type="image/png",
        )
        approve_response = self.client.post(
            f"/api/v1/hr/vacations/{loan_id}/approve/",
            {
                "approved_amount": "450000",
                "comment": "Aprobado parcial por tesoreria",
                "signature_override": treasury_signature,
            },
            format="multipart",
        )

        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.data["status"], "APPROVED")
        self.assertEqual(approve_response.data["hr_decision"], "APPROVED")
        self.assertEqual(approve_response.data["admin_decision"], "")
        self.assertEqual(approve_response.data["loan_approved_amount"], "450000.00")

    def test_hr_can_view_but_not_manage_loan_requests(self):
        vacation = VacationRequest.objects.create(
            employee=self.employee,
            request_type=VacationRequest.RequestType.LOAN,
            start_date="2026-08-03",
            end_date="2026-08-03",
            is_full_day=True,
            loan_amount="500000",
            loan_requester_name="Ana Perez",
            loan_requester_document="1234567890",
            loan_city="Bogota",
            loan_position="Auxiliar operativo",
            loan_concept="Calamidad domestica",
            loan_frequency="BIWEEKLY",
            loan_installments_count=4,
        )
        self.client.force_authenticate(
            get_user_model().objects.create_user(
                email="rrhh-prestamos@example.com",
                password="SecurePass123!",
                role=Role.objects.get(code="RRHH"),
            )
        )

        list_response = self.client.get("/api/v1/hr/vacations/loans/")
        approve_response = self.client.post(f"/api/v1/hr/vacations/{vacation.id}/approve/", {"comment": "Aprobado"}, format="json")
        reject_response = self.client.post(f"/api/v1/hr/vacations/{vacation.id}/reject/", {"comment": "Rechazado"}, format="json")
        edit_response = self.client.patch(f"/api/v1/hr/vacations/{vacation.id}/", {"reason": "Cambio"}, format="json")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(approve_response.status_code, 403)
        self.assertEqual(reject_response.status_code, 403)
        self.assertEqual(edit_response.status_code, 403)
