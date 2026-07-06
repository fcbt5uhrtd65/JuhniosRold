from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.catalog.infrastructure.models import Category, Price, Product, ProductVariant
from apps.catalog.infrastructure.tasks import _collect_rows, _load_image_bytes


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

    def test_export_uses_variant_image_not_product_image(self):
        category = Category.objects.create(name="Capilar 2", slug="capilar-2", is_active=True)
        product = Product.objects.create(
            category=category,
            name="Aceite Capilar Argan",
            slug="aceite-capilar-argan",
            is_active=True,
            image_url="/images/catalog/Aceite Capilar Argan 8ml.png",
        )
        small = ProductVariant.objects.create(
            product=product, sku="JR-CAT-007", name="8 ML", cost=100, is_active=True,
            image_url="/images/catalog/Aceite Capilar Argan 8ml.png",
        )
        large = ProductVariant.objects.create(
            product=product, sku="JR-CAT-015", name="120 ML", cost=1000, is_active=True,
            image_url="/images/catalog/Aceite Capilar Argan 120ml.png",
        )
        Price.objects.create(variant=small, amount=747, valid_from="2024-01-01T00:00:00Z", is_active=True)
        Price.objects.create(variant=large, amount=3775, valid_from="2024-01-01T00:00:00Z", is_active=True)

        rows = _collect_rows([product.id])

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["sku"], small.sku)
        self.assertEqual(rows[0]["image_url"], small.image_url)
        self.assertNotEqual(rows[0]["image_url"], large.image_url)

    @override_settings(FRONTEND_URL="https://juhniosrold.cloud")
    def test_relative_catalog_image_resolves_against_frontend_url(self):
        """Las fotos reales del catálogo se guardan como rutas relativas
        (/images/catalog/...) porque las sirve el frontend/nginx, no Django;
        _load_image_bytes debe resolverlas contra FRONTEND_URL en vez de
        descartarlas como si fueran una ruta de MEDIA_ROOT inexistente."""
        with patch("apps.catalog.infrastructure.tasks._download_public_image") as mock_download:
            mock_download.return_value = b"fake-image-bytes"
            result = _load_image_bytes("/images/catalog/Aceite Capilar Argan 8ml.png")

        mock_download.assert_called_once_with(
            "https://juhniosrold.cloud/images/catalog/Aceite%20Capilar%20Argan%208ml.png",
            skip_ssrf_check=True,
        )
        self.assertEqual(result, b"fake-image-bytes")
