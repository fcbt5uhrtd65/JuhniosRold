from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.catalog.infrastructure.models import Category, Price, Product, ProductVariant


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    CELERY_TASK_STORE_EAGER_RESULT=True,
)
class ProductExportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = get_user_model().objects.create_superuser(
            email="admin-export@example.com",
            password="password-seguro",
        )
        self.client.force_authenticate(self.admin)

        category = Category.objects.create(name="Capilar", slug="capilar", is_active=True)
        self.product = Product.objects.create(
            category=category, name="Shampoo Test", slug="shampoo-test", is_active=True,
        )
        variant = ProductVariant.objects.create(
            product=self.product, sku="SKU-TEST-1", name="500ml", cost=1000, is_active=True,
        )
        Price.objects.create(variant=variant, amount=2000, valid_from="2024-01-01T00:00:00Z", is_active=True)

    def test_export_enqueues_task_and_status_resolves(self):
        response = self.client.post(
            "/api/v1/catalog/exports/",
            {"product_ids": [str(self.product.id)], "format": "xlsx"},
            format="json",
        )
        self.assertEqual(response.status_code, 202)
        task_id = response.data["task_id"]

        status_response = self.client.get(f"/api/v1/catalog/exports/{task_id}/")
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.data["status"], "success")
        self.assertTrue(status_response.data["url"].endswith(".xlsx"))
        self.assertEqual(status_response.data["count"], 1)

    def test_export_rejects_empty_product_ids(self):
        response = self.client.post(
            "/api/v1/catalog/exports/", {"product_ids": [], "format": "xlsx"}, format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_export_requires_authentication(self):
        anonymous_client = APIClient()
        response = anonymous_client.post(
            "/api/v1/catalog/exports/",
            {"product_ids": [str(self.product.id)], "format": "xlsx"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
