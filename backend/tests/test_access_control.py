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
