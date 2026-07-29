from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.identity.infrastructure.models import Component, Role


class AccessControlTests(TestCase):
    def test_single_role_assignment_and_component_access(self):
        rrhh_role = Role.objects.get(code="RRHH")
        hr_component = Component.objects.get(code="human_resources.management")

        user = get_user_model().objects.create_user(
            email="rrhh@example.com",
            password="SecurePass123!",
            role=rrhh_role,
        )

        self.assertEqual(user.role.code, "RRHH")
        self.assertTrue(user.has_component_access(hr_component.code, "view"))
        self.assertTrue(user.has_component_access(hr_component.code, "edit"))

    def test_admin_bypasses_component_permissions(self):
        admin = get_user_model().objects.create_superuser(
            email="admin-permisos@example.com",
            password="SecurePass123!",
        )

        self.assertTrue(admin.has_full_access)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.has_component_access("any.component", "edit"))

    def test_loans_component_permissions_for_accounting_and_treasury(self):
        contabilidad_role = Role.objects.get(code="CONTABILIDAD")
        tesoreria_role = Role.objects.get(code="TESORERIA")

        accountant = get_user_model().objects.create_user(
            email="contabilidad@example.com",
            password="SecurePass123!",
            role=contabilidad_role,
        )
        treasurer = get_user_model().objects.create_user(
            email="tesoreria@example.com",
            password="SecurePass123!",
            role=tesoreria_role,
        )
        employee_with_treasury = get_user_model().objects.create_user(
            email="empleado-tesoreria@example.com",
            password="SecurePass123!",
            role=Role.objects.get(code="EMPLEADO"),
        )
        employee_with_treasury.additional_roles.add(tesoreria_role)

        self.assertTrue(accountant.can_view_loans)
        self.assertFalse(accountant.can_manage_loans)
        self.assertTrue(treasurer.can_view_loans)
        self.assertTrue(treasurer.can_manage_loans)
        self.assertTrue(employee_with_treasury.can_view_loans)
        self.assertTrue(employee_with_treasury.can_manage_loans)
