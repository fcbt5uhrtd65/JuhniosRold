from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.infrastructure.models import Category, Price, Product, ProductVariant
from apps.chatbot.application import ChatbotService
from apps.commerce.infrastructure.models import Order
from apps.customers.infrastructure.models import Customer


class ChatbotBusinessTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Capilar", slug="capilar", is_active=True)
        self.product = Product.objects.create(
            category=self.category,
            name="Full Liso",
            slug="full-liso",
            description="Linea para controlar volumen y frizz.",
            is_active=True,
            is_featured=True,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku="FULL-LISO-001",
            name="Full Liso unidad",
            is_active=True,
        )
        Price.objects.create(
            variant=self.variant,
            amount=Decimal("42000"),
            currency="COP",
            valid_from=timezone.now(),
            is_active=True,
        )
        self.cream_product = Product.objects.create(
            category=self.category,
            name="Crema de Peinar Nutritiva",
            slug="crema-de-peinar-nutritiva",
            description="Crema para peinar y controlar el frizz sin apelmazar.",
            is_active=True,
        )
        self.cream_variant = ProductVariant.objects.create(
            product=self.cream_product,
            sku="CREMA-PEINAR-001",
            name="Crema de Peinar unidad",
            is_active=True,
        )
        Price.objects.create(
            variant=self.cream_variant,
            amount=Decimal("28000"),
            currency="COP",
            valid_from=timezone.now(),
            is_active=True,
        )
        self.service = ChatbotService()

    def test_recommends_catalog_products_for_hair_need(self):
        response = self.service.respond_to_text("Que me recomiendas para el frizz")

        self.assertEqual(response.intent, "Recomendar producto")
        self.assertIn("Full Liso", response.fulfillment_text)
        self.assertEqual(response.payload["products"][0]["name"], "Full Liso")
        self.assertEqual(response.payload["products"][0]["priceFrom"], "42000.00")

    def test_buy_product_uses_catalog_data_without_promising_stock(self):
        response = self.service.respond_to_text("quiero comprar Full Liso")

        self.assertEqual(response.intent, "Comprar producto")
        self.assertIn("Full Liso", response.fulfillment_text)
        self.assertIn("confirma precio y disponibilidad", response.fulfillment_text)
        self.assertEqual(response.payload["products"][0]["catalogPath"], "/catalogo?producto=full-liso")

    def test_unknown_question_goes_to_advisor(self):
        response = self.service.respond_to_text("necesito una garantia medica")

        self.assertEqual(response.intent, "Fallback")
        self.assertIn("prefiero no inventarla", response.fulfillment_text)
        self.assertIn("whatsappUrl", response.payload)

    def test_free_text_search_finds_real_product_with_price(self):
        response = self.service.respond_to_text("necesito crema de peinar")

        self.assertEqual(response.intent, "Buscar producto")
        self.assertIn("Crema de Peinar Nutritiva", response.fulfillment_text)
        self.assertIn("28,000", response.fulfillment_text)
        self.assertEqual(response.payload["products"][0]["priceFrom"], "28000.00")

    def test_fallback_still_searches_catalog_before_giving_up(self):
        response = self.service.respond_to_text("tienen shampoo?")

        self.assertEqual(response.intent, "Fallback")
        self.assertIn("prefiero no inventarla", response.fulfillment_text)

    def test_greetings_return_welcome_response(self):
        for message in ("hola", "cómo estás?", "qué onda", "hi", "hello", "holis"):
            with self.subTest(message=message):
                response = self.service.respond_to_text(message)

                self.assertEqual(response.intent, "Saludo")
                self.assertIn("gusto saludarte", response.fulfillment_text)
                self.assertIn("catalogUrl", response.payload)

    def test_order_status_can_read_existing_order_by_number(self):
        user = get_user_model().objects.create_user(
            email="cliente-chatbot@example.com",
            password="password-seguro",
        )
        customer = Customer.objects.create(
            user=user,
            document_number="100200300",
            first_name="Cliente",
            last_name="Chatbot",
            email="cliente-chatbot@example.com",
        )
        order = Order.objects.create(
            customer=customer,
            status=Order.Status.PROCESSING,
            shipping_address="{}",
            tracking_number="GUIA-123",
        )

        response = self.service.respond_to_text(f"estado de mi pedido {order.number}")

        self.assertEqual(response.intent, "Estado de pedido")
        self.assertIn(order.number, response.fulfillment_text)
        self.assertIn("En preparación", response.fulfillment_text)
        self.assertIn("GUIA-123", response.fulfillment_text)


class ChatbotApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        category = Category.objects.create(name="Capilar", slug="capilar", is_active=True)
        product = Product.objects.create(
            category=category,
            name="Full Liso",
            slug="full-liso",
            description="Linea para controlar volumen y frizz.",
            is_active=True,
        )
        ProductVariant.objects.create(
            product=product,
            sku="FULL-LISO-001",
            name="Full Liso unidad",
            is_active=True,
        )

    def test_message_endpoint_returns_business_response(self):
        response = self.client.post(
            "/api/chatbot/message/",
            {"message": "quiero comprar Full Liso", "sessionId": "abc"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["intent"], "Comprar producto")
        self.assertEqual(response.data["sessionId"], "abc")

    def test_city_alone_after_shipping_question_keeps_context(self):
        first = self.client.post(
            "/api/chatbot/message/",
            {"message": "envio", "sessionId": "ctx-1"},
            format="json",
        )
        self.assertEqual(first.data["intent"], "Consulta de envio")
        self.assertIn("ciudad", first.data["fulfillmentText"])

        second = self.client.post(
            "/api/chatbot/message/",
            {"message": "Barranquilla", "sessionId": "ctx-1"},
            format="json",
        )
        self.assertEqual(second.data["intent"], "Consulta de envio")
        self.assertIn("Barranquilla", second.data["fulfillmentText"])
        self.assertIn("3-4 dias habiles", second.data["fulfillmentText"])

    def test_dialogflow_webhook_endpoint_uses_query_result(self):
        response = self.client.post(
            "/dialogflow/webhook/",
            {
                "queryResult": {
                    "intent": {"displayName": "Consulta de envio"},
                    "parameters": {"ciudad": "Bogota"},
                    "queryText": "cuanto demora a Bogota",
                }
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["intent"], "Consulta de envio")
        self.assertIn("2-3 dias habiles", response.data["fulfillmentText"])
