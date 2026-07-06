from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.catalog.infrastructure.models import Category, Price, Product, ProductVariant
from apps.inventory.infrastructure.models import Stock


class PublicCatalogTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Capilar", slug="capilar", is_active=True)
        self.product = Product.objects.create(
            category=self.category,
            name="Producto activo",
            slug="producto-activo",
            is_active=True,
        )
        Product.objects.create(
            category=self.category,
            name="Producto inactivo",
            slug="producto-inactivo",
            is_active=False,
        )

    def test_anonymous_users_can_list_active_categories_and_products(self):
        categories_response = self.client.get("/api/v1/catalog/categories/")
        products_response = self.client.get("/api/v1/catalog/products/")

        self.assertEqual(categories_response.status_code, 200)
        self.assertEqual(products_response.status_code, 200)
        self.assertEqual(categories_response.data["count"], 1)
        self.assertEqual(products_response.data["count"], 1)
        self.assertEqual(products_response.data["results"][0]["id"], str(self.product.id))

    def test_anonymous_users_can_retrieve_an_active_product(self):
        response = self.client.get(f"/api/v1/catalog/products/{self.product.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], self.product.name)

    def test_anonymous_users_cannot_create_catalog_records(self):
        response = self.client.post(
            "/api/v1/catalog/categories/",
            {"name": "Nueva", "slug": "nueva", "is_active": True},
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    def test_regular_authenticated_users_cannot_modify_catalog(self):
        user = get_user_model().objects.create_user(
            email="cliente@example.com",
            password="password-seguro",
        )
        self.client.force_authenticate(user)

        response = self.client.post(
            "/api/v1/catalog/categories/",
            {"name": "Nueva", "slug": "nueva", "is_active": True},
            format="json",
        )

        self.assertEqual(response.status_code, 403)


class CatalogSeederTests(TestCase):
    def test_seed_catalog_only_runs_when_catalog_is_empty(self):
        call_command("seed_catalog")

        self.assertEqual(Category.objects.count(), 7)
        self.assertEqual(Product.objects.count(), 52)
        self.assertEqual(ProductVariant.objects.count(), 104)
        self.assertEqual(Price.objects.count(), 104)
        self.assertEqual(Stock.objects.count(), 104)

        aceite_corporal = ProductVariant.objects.get(product__name="ACEITE CORPORAL", presentation_number=250)
        self.assertEqual(aceite_corporal.presentation_number, 250)
        self.assertEqual(aceite_corporal.presentation_unit, "ML")

        keratina = ProductVariant.objects.get(product__name="TRATAMIENTO NUTRITIVO KERATINA", presentation_number=30)
        self.assertEqual(keratina.presentation_number, 30)
        self.assertEqual(keratina.presentation_unit, "GR")

        call_command("seed_catalog")

        self.assertEqual(Product.objects.count(), 52)
        self.assertEqual(Stock.objects.count(), 104)
