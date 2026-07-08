from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.catalog.infrastructure.models import Category, FlipbookCatalog, Price, Product, ProductVariant
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


class FlipbookCatalogTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.active_catalog = FlipbookCatalog.objects.create(
            title="Catalogo comercial",
            label="Productos Juhnios Rold",
            description="Portafolio general",
            url="https://heyzine.com/flip-book/5bc27eccc9.html#page/10",
            accent_color="#2D3A1F",
            sort_order=2,
            is_active=True,
        )
        self.first_catalog = FlipbookCatalog.objects.create(
            title="Catalogo profesional",
            label="Linea para negocios",
            url="https://heyzine.com/flip-book/8e41ab4a8b.html",
            accent_color="#8B7355",
            sort_order=1,
            is_active=True,
        )
        self.hidden_catalog = FlipbookCatalog.objects.create(
            title="Catalogo oculto",
            url="https://heyzine.com/flip-book/d249fca6ef.html",
            is_active=False,
        )

    def test_anonymous_users_can_list_only_active_flipbooks_ordered(self):
        response = self.client.get("/api/v1/catalog/flipbooks/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], FlipbookCatalog.objects.filter(is_active=True).count())
        response_ids = [item["id"] for item in response.data["results"]]
        self.assertIn(str(self.active_catalog.id), response_ids)
        self.assertIn(str(self.first_catalog.id), response_ids)
        self.assertNotIn(str(self.hidden_catalog.id), response_ids)

    def test_regular_authenticated_users_can_list_only_active_flipbooks(self):
        user = get_user_model().objects.create_user(
            email="cliente-catalogos@example.com",
            password="password-seguro",
        )
        self.client.force_authenticate(user)

        response = self.client.get("/api/v1/catalog/flipbooks/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], FlipbookCatalog.objects.filter(is_active=True).count())
        response_ids = [item["id"] for item in response.data["results"]]
        self.assertNotIn(str(self.hidden_catalog.id), response_ids)

    def test_anonymous_users_cannot_create_flipbooks(self):
        response = self.client.post(
            "/api/v1/catalog/flipbooks/",
            {
                "title": "Nuevo catalogo",
                "url": "https://heyzine.com/flip-book/new.html",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    def test_admin_users_can_create_flipbooks(self):
        admin = get_user_model().objects.create_superuser(
            email="admin-catalogos@example.com",
            password="SecurePass123!",
        )
        self.client.force_authenticate(admin)

        response = self.client.post(
            "/api/v1/catalog/flipbooks/",
            {
                "title": "Catalogo complementario",
                "label": "Seleccion destacada",
                "description": "Referencias adicionales",
                "url": "https://heyzine.com/flip-book/d249fca6ef.html",
                "accent_color": "#7C2D12",
                "sort_order": 3,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(FlipbookCatalog.objects.filter(title="Catalogo complementario").exists())


class CatalogSeederTests(TestCase):
    def test_seed_catalog_only_runs_when_catalog_is_empty(self):
        call_command("seed_catalog")

        self.assertEqual(Category.objects.count(), 7)
        self.assertEqual(Product.objects.count(), 93)
        self.assertEqual(ProductVariant.objects.count(), 150)
        self.assertEqual(Price.objects.count(), 150)
        self.assertEqual(Stock.objects.count(), 150)

        aceite_corporal = ProductVariant.objects.get(product__name="ACEITE CORPORAL COCO", presentation_number=250)
        self.assertEqual(aceite_corporal.presentation_number, 250)
        self.assertEqual(aceite_corporal.presentation_unit, "ML")

        aceite_capilar = ProductVariant.objects.get(product__name="ACEITE CAPILAR ARGAN", presentation_number=120)
        self.assertEqual(aceite_capilar.presentation_label, "120 ML")

        coco = ProductVariant.objects.get(product__name="ACEITE CAPILAR COCO", presentation_number=8)
        self.assertEqual(coco.prices.get(is_active=True).amount, 747)
        self.assertIn("Aceite Capilar Coco 8ml.png", coco.image_url)

        coco_120 = ProductVariant.objects.get(product__name="ACEITE CAPILAR COCO", presentation_number=120)
        self.assertIn("Aceite Capilar Coco 120", coco_120.image_url)
        self.assertNotEqual(coco.image_url, coco_120.image_url)

        keratina = ProductVariant.objects.get(product__name="TRATAMIENTO NUTRITIVO CAPILAR KERATINA CEBOLLA", presentation_number=30)
        self.assertEqual(keratina.presentation_number, 30)
        self.assertEqual(keratina.presentation_unit, "GR")

        call_command("seed_catalog")

        self.assertEqual(Product.objects.count(), 93)
        self.assertEqual(Stock.objects.count(), 150)

    def test_seed_catalog_replace_recreates_seeded_products(self):
        call_command("seed_catalog")
        first_product_id = Product.objects.get(name="ACEITE CAPILAR COCO").id

        call_command("seed_catalog", "--replace")

        self.assertEqual(Category.objects.count(), 7)
        self.assertEqual(Product.objects.count(), 93)
        self.assertEqual(ProductVariant.objects.count(), 150)
        self.assertEqual(Price.objects.count(), 150)
        self.assertEqual(Stock.objects.count(), 150)
        self.assertFalse(Product.objects.filter(id=first_product_id).exists())

        coco = ProductVariant.objects.get(product__name="ACEITE CAPILAR COCO", presentation_number=8)
        self.assertEqual(coco.sku, "JR-CAT-009")
        self.assertEqual(coco.prices.get(is_active=True).amount, 747)
