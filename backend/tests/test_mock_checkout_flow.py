from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.infrastructure.models import Category, Price, Product, ProductVariant
from apps.commerce.infrastructure.models import Cart, CartItem, Order, Payment
from apps.customers.infrastructure.models import Customer
from apps.finance.infrastructure.models import FinancialTransaction, SalesInvoice
from apps.inventory.infrastructure.models import (
    InventoryMovement,
    Location,
    Stock,
    Warehouse,
)


@override_settings(PAYMENT_PROVIDER="mock")
class MockCheckoutFlowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="carrito@example.com",
            password="password-seguro",
            first_name="Carla",
        )
        self.customer = Customer.objects.create(
            user=self.user,
            document_type="CC",
            document_number="123456789",
            first_name="Carla",
            last_name="Cliente",
            email=self.user.email,
        )
        category = Category.objects.create(name="Capilar", slug="mock-capilar")
        product = Product.objects.create(
            category=category,
            name="Tratamiento",
            slug="mock-tratamiento",
            is_active=True,
        )
        self.variant = ProductVariant.objects.create(
            product=product,
            sku="MOCK-SKU-1",
            name="250 ml",
            is_active=True,
        )
        Price.objects.create(
            variant=self.variant,
            amount=Decimal("45000"),
            currency="COP",
            valid_from=timezone.now(),
            is_active=True,
        )
        warehouse = Warehouse.objects.create(name="Principal", code="PRINCIPAL")
        self.location = Location.objects.create(
            warehouse=warehouse,
            name="Catálogo",
            code="CATALOGO",
        )
        self.stock = Stock.objects.create(
            variant=self.variant,
            location=self.location,
            quantity=Decimal("10"),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def add_to_cart(self, quantity=2):
        return self.client.post(
            "/api/v1/commerce/cart/items/",
            {"variant_id": str(self.variant.id), "quantity": quantity},
            format="json",
        )

    def checkout_and_start_payment(self):
        checkout = self.client.post(
            "/api/v1/commerce/cart/checkout/",
            {"shipping_address": "Calle 10 # 20-30"},
            format="json",
        )
        self.assertEqual(checkout.status_code, 201)
        order_id = checkout.data["id"]
        start = self.client.post(
            "/api/v1/commerce/payments/start/",
            {"order_id": order_id},
            format="json",
        )
        self.assertEqual(start.status_code, 200)
        self.assertEqual(start.data["provider"], "mock")
        self.assertFalse(start.data["requires_redirect"])
        return order_id, start.data["payment_id"]

    def test_cart_is_persisted_and_restored_for_same_customer(self):
        response = self.add_to_cart(quantity=2)
        self.assertEqual(response.status_code, 201)
        cart = Cart.objects.get(customer=self.customer, checked_out_at__isnull=True)
        item = CartItem.objects.get(cart=cart, variant=self.variant)
        self.assertEqual(item.quantity, Decimal("2"))

        self.client.force_authenticate(user=None)
        self.client.force_authenticate(self.user)
        restored = self.client.get("/api/v1/commerce/cart/")

        self.assertEqual(restored.status_code, 200)
        self.assertEqual(len(restored.data["items"]), 1)
        self.assertEqual(restored.data["items"][0]["variant_id"], str(self.variant.id))
        self.assertEqual(Decimal(restored.data["items"][0]["quantity"]), Decimal("2"))

    def test_adding_same_variant_accumulates_in_single_database_line(self):
        self.add_to_cart(quantity=1)
        self.add_to_cart(quantity=3)
        cart = Cart.objects.get(customer=self.customer, checked_out_at__isnull=True)
        self.assertEqual(CartItem.objects.filter(cart=cart).count(), 1)
        self.assertEqual(CartItem.objects.get(cart=cart).quantity, Decimal("4"))

    def test_approved_mock_payment_consumes_stock_and_generates_invoice_once(self):
        self.add_to_cart(quantity=2)
        order_id, payment_id = self.checkout_and_start_payment()

        approved = self.client.post(
            f"/api/v1/commerce/payments/mock/{payment_id}/resolve/",
            {"outcome": "approved"},
            format="json",
        )
        duplicate = self.client.post(
            f"/api/v1/commerce/payments/mock/{payment_id}/resolve/",
            {"outcome": "approved"},
            format="json",
        )

        self.assertEqual(approved.status_code, 200)
        self.assertEqual(duplicate.status_code, 200)
        order = Order.objects.get(pk=order_id)
        payment = Payment.objects.get(pk=payment_id)
        self.stock.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(payment.status, Payment.Status.APPROVED)
        self.assertEqual(self.stock.quantity, Decimal("8"))
        self.assertEqual(self.stock.reserved_quantity, Decimal("0"))
        self.assertEqual(SalesInvoice.objects.filter(order=order).count(), 1)
        self.assertEqual(
            FinancialTransaction.objects.filter(reference=order.number).count(),
            1,
        )
        self.assertEqual(
            InventoryMovement.objects.filter(reference=order.number).count(),
            1,
        )
        self.assertTrue(approved.data["invoice_number"].startswith("FAC-JR-"))

    def test_declined_mock_payment_releases_stock_and_does_not_invoice(self):
        self.add_to_cart(quantity=2)
        order_id, payment_id = self.checkout_and_start_payment()

        rejected = self.client.post(
            f"/api/v1/commerce/payments/mock/{payment_id}/resolve/",
            {"outcome": "declined"},
            format="json",
        )

        self.assertEqual(rejected.status_code, 200)
        order = Order.objects.get(pk=order_id)
        self.stock.refresh_from_db()
        self.assertEqual(order.status, Order.Status.FAILED)
        self.assertEqual(self.stock.quantity, Decimal("10"))
        self.assertEqual(self.stock.reserved_quantity, Decimal("0"))
        self.assertFalse(SalesInvoice.objects.filter(order=order).exists())
        self.assertFalse(
            FinancialTransaction.objects.filter(reference=order.number).exists()
        )

    def test_customer_can_retry_failed_order_after_signing_in_again(self):
        self.add_to_cart(quantity=2)
        order_id, first_payment_id = self.checkout_and_start_payment()
        self.client.post(
            f"/api/v1/commerce/payments/mock/{first_payment_id}/resolve/",
            {"outcome": "declined"},
            format="json",
        )

        self.client.force_authenticate(user=None)
        self.client.force_authenticate(self.user)
        retry = self.client.post(
            "/api/v1/commerce/payments/start/",
            {"order_id": order_id},
            format="json",
        )

        self.assertEqual(retry.status_code, 200)
        self.assertNotEqual(retry.data["payment_id"], first_payment_id)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.reserved_quantity, Decimal("2"))

        approved = self.client.post(
            f"/api/v1/commerce/payments/mock/{retry.data['payment_id']}/resolve/",
            {"outcome": "approved"},
            format="json",
        )

        self.assertEqual(approved.status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, Decimal("8"))
        self.assertEqual(self.stock.reserved_quantity, Decimal("0"))
        self.assertEqual(SalesInvoice.objects.filter(order_id=order_id).count(), 1)

    def test_checkout_marks_old_cart_and_next_login_gets_new_empty_cart(self):
        self.add_to_cart(quantity=1)
        old_cart = Cart.objects.get(customer=self.customer, checked_out_at__isnull=True)
        self.checkout_and_start_payment()
        old_cart.refresh_from_db()
        self.assertIsNotNone(old_cart.checked_out_at)

        new_cart_response = self.client.get("/api/v1/commerce/cart/")
        self.assertEqual(new_cart_response.status_code, 200)
        self.assertEqual(new_cart_response.data["items"], [])
        self.assertNotEqual(new_cart_response.data["id"], str(old_cart.id))
