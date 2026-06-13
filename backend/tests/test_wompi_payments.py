import hashlib
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.infrastructure.models import Category, Price, Product, ProductVariant
from apps.commerce.application.use_cases import (
    ConfirmWompiPayment,
    CreateOrder,
    InitiateWompiPayment,
)
from apps.commerce.domain.exceptions import (
    InvalidWebhookSignature,
    PaymentConfigurationError,
)
from apps.commerce.infrastructure.models import (
    Order,
    Payment,
    PaymentWebhookEvent,
)
from apps.commerce.infrastructure.wompi_client import WompiClient
from apps.customers.infrastructure.models import Customer
from apps.inventory.infrastructure.models import (
    InventoryMovement,
    Location,
    Stock,
    Warehouse,
)
from shared.domain.exceptions import BusinessRuleViolation


class FakeWompiGateway:
    public_key = "pub_test_example"

    def build_integrity_signature(self, **_parameters):
        return "signed"

    def build_checkout_url(self, **parameters):
        return f"https://checkout.wompi.co/p/?reference={parameters['reference']}"

    def validate_event(self, _payload, _header_checksum=""):
        return None


@override_settings(
    PAYMENT_PROVIDER="wompi",
    WOMPI_ENVIRONMENT="sandbox",
    WOMPI_PUBLIC_KEY="pub_test_example",
    WOMPI_PRIVATE_KEY="prv_test_example",
    WOMPI_EVENTS_SECRET="test_events_example",
    WOMPI_INTEGRITY_SECRET="test_integrity_example",
    WOMPI_BASE_URL="https://sandbox.wompi.co/v1",
    WOMPI_HTTP_TIMEOUT=1,
    WOMPI_CHECKOUT_EXPIRATION_MINUTES=30,
)
class WompiPaymentTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="cliente@example.com",
            password="secret123",
        )
        self.customer = Customer.objects.create(
            user=self.user,
            document_number="10000001",
            first_name="Ana",
            last_name="Cliente",
            email=self.user.email,
            phone="3001234567",
        )
        category = Category.objects.create(name="Capilar", slug="capilar-test")
        product = Product.objects.create(
            category=category,
            name="Shampoo",
            slug="shampoo-test",
        )
        self.variant = ProductVariant.objects.create(
            product=product,
            sku="SKU-WOMPI-1",
            name="500 ml",
        )
        Price.objects.create(
            variant=self.variant,
            amount=Decimal("50000.00"),
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

    def create_order(self, quantity=Decimal("2")):
        return CreateOrder().execute(
            customer=self.customer,
            location=self.location,
            shipping_address="Calle 1",
            items=[{"variant_id": self.variant.id, "quantity": quantity}],
            actor=self.user,
        )

    def initiate_payment(self, order):
        return InitiateWompiPayment(gateway=FakeWompiGateway()).execute(
            order_id=order.id,
            actor=self.user,
        )

    @staticmethod
    def event_for(payment, status="APPROVED", checksum="event-checksum"):
        return {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": "1234-transaction",
                    "amount_in_cents": payment.amount_in_cents,
                    "reference": payment.reference,
                    "currency": payment.currency,
                    "payment_method_type": "CARD",
                    "status": status,
                }
            },
            "environment": "test",
            "signature": {
                "properties": [
                    "transaction.id",
                    "transaction.status",
                    "transaction.amount_in_cents",
                ],
                "checksum": checksum,
            },
            "timestamp": 1530291411,
        }

    def test_initiate_payment_reserves_stock_and_returns_checkout_data(self):
        order = self.create_order()
        checkout = self.initiate_payment(order)

        order.refresh_from_db()
        self.stock.refresh_from_db()
        payment = Payment.objects.get(order=order)

        self.assertEqual(order.status, Order.Status.PAYMENT_PENDING)
        self.assertEqual(self.stock.quantity, Decimal("10"))
        self.assertEqual(self.stock.reserved_quantity, Decimal("2"))
        self.assertEqual(payment.amount_in_cents, 10_000_000)
        self.assertEqual(checkout.reference, payment.reference)
        self.assertIn(payment.reference, checkout.checkout_url)
        self.assertEqual(checkout.redirect_url, "")

    @override_settings(FRONTEND_URL="https://shop.example.com")
    def test_initiate_payment_uses_https_redirect_url(self):
        order = self.create_order()

        checkout = self.initiate_payment(order)

        self.assertEqual(
            checkout.redirect_url,
            f"https://shop.example.com/pago/resultado?pedido_id={order.id}",
        )

    def test_approved_webhook_consumes_inventory_once(self):
        order = self.create_order()
        self.initiate_payment(order)
        payment = Payment.objects.get(order=order)
        event = self.event_for(payment)

        use_case = ConfirmWompiPayment(gateway=FakeWompiGateway())
        first = use_case.execute(payload=event)
        second = use_case.execute(payload=event)

        order.refresh_from_db()
        payment.refresh_from_db()
        self.stock.refresh_from_db()

        self.assertTrue(first.processed)
        self.assertTrue(second.duplicate)
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(payment.status, Payment.Status.APPROVED)
        self.assertEqual(self.stock.quantity, Decimal("8"))
        self.assertEqual(self.stock.reserved_quantity, Decimal("0"))
        self.assertEqual(
            InventoryMovement.objects.filter(reference=order.number).count(),
            1,
        )
        self.assertEqual(PaymentWebhookEvent.objects.count(), 1)

    def test_declined_webhook_releases_reservation_without_decrementing_stock(self):
        order = self.create_order()
        self.initiate_payment(order)
        payment = Payment.objects.get(order=order)

        ConfirmWompiPayment(gateway=FakeWompiGateway()).execute(
            payload=self.event_for(payment, status="DECLINED")
        )

        order.refresh_from_db()
        payment.refresh_from_db()
        self.stock.refresh_from_db()
        self.assertEqual(order.status, Order.Status.FAILED)
        self.assertEqual(payment.status, Payment.Status.DECLINED)
        self.assertEqual(self.stock.quantity, Decimal("10"))
        self.assertEqual(self.stock.reserved_quantity, Decimal("0"))

    def test_old_declined_attempt_does_not_release_new_attempt_reservation(self):
        order = self.create_order()
        self.initiate_payment(order)
        old_payment = Payment.objects.get(order=order)
        old_payment.status = Payment.Status.ERROR
        old_payment.save(update_fields=("status", "updated_at"))

        new_payment = Payment.objects.create(
            order=order,
            reference=f"{order.number}-RETRY",
            amount_in_cents=old_payment.amount_in_cents,
            currency="COP",
        )
        event = self.event_for(old_payment, status="DECLINED", checksum="old-declined")
        event["data"]["transaction"]["id"] = "old-transaction"

        ConfirmWompiPayment(gateway=FakeWompiGateway()).execute(payload=event)

        order.refresh_from_db()
        new_payment.refresh_from_db()
        self.stock.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAYMENT_PENDING)
        self.assertEqual(new_payment.status, Payment.Status.PENDING)
        self.assertEqual(self.stock.reserved_quantity, Decimal("2"))

    def test_webhook_rejects_amount_tampering(self):
        order = self.create_order()
        self.initiate_payment(order)
        payment = Payment.objects.get(order=order)
        event = self.event_for(payment)
        event["data"]["transaction"]["amount_in_cents"] += 1

        with self.assertRaises(BusinessRuleViolation):
            ConfirmWompiPayment(gateway=FakeWompiGateway()).execute(payload=event)

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PENDING)

    def test_order_cannot_be_created_with_insufficient_stock(self):
        with self.assertRaises(BusinessRuleViolation):
            self.create_order(quantity=Decimal("11"))
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.reserved_quantity, Decimal("0"))

    def test_paid_order_cannot_start_another_payment(self):
        order = self.create_order()
        order.status = Order.Status.PAID
        order.save(update_fields=("status", "updated_at"))

        with self.assertRaises(BusinessRuleViolation):
            self.initiate_payment(order)

    def test_start_endpoint_supports_requested_pedido_id_contract(self):
        order = self.create_order()
        response = self.client.post(
            "/api/pagos/wompi/iniciar/",
            {"pedido_id": str(order.id)},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["currency"], "COP")
        self.assertEqual(response.data["reference"], Payment.objects.get(order=order).reference)
        self.assertNotIn("private_key", response.data)

    def test_requested_order_detail_alias_returns_owned_order(self):
        order = self.create_order()

        response = self.client.get(f"/api/pedidos/{order.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(order.id))

    def test_start_endpoint_returns_404_for_unknown_order(self):
        response = self.client.post(
            "/api/pagos/wompi/iniciar/",
            {"pedido_id": "00000000-0000-0000-0000-000000000001"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_customer_cannot_patch_order_to_paid(self):
        order = self.create_order()
        response = self.client.patch(
            f"/api/v1/commerce/orders/{order.id}/",
            {"status": "PAID"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_other_customer_cannot_start_payment(self):
        order = self.create_order()
        other_user = get_user_model().objects.create_user(
            email="otro@example.com",
            password="secret123",
        )
        Customer.objects.create(
            user=other_user,
            document_number="10000002",
            first_name="Otro",
            last_name="Cliente",
            email=other_user.email,
        )
        self.client.force_authenticate(other_user)

        response = self.client.post(
            "/api/pagos/wompi/iniciar/",
            {"pedido_id": str(order.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Payment.objects.filter(order=order).exists())

    def test_webhook_signature_uses_dynamic_properties(self):
        payload = {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": "tx-1",
                    "status": "APPROVED",
                    "amount_in_cents": 10000,
                }
            },
            "environment": "test",
            "signature": {
                "properties": [
                    "transaction.status",
                    "transaction.id",
                    "transaction.amount_in_cents",
                ],
                "checksum": "",
            },
            "timestamp": 123,
        }
        signed = "APPROVEDtx-110000123test_events_example"
        payload["signature"]["checksum"] = hashlib.sha256(signed.encode()).hexdigest()

        WompiClient().validate_event(payload)

    def test_webhook_rejects_invalid_signature(self):
        payload = {
            "event": "transaction.updated",
            "data": {"transaction": {"id": "tx-1"}},
            "environment": "test",
            "signature": {
                "properties": ["transaction.id"],
                "checksum": "invalid",
            },
            "timestamp": 123,
        }
        with self.assertRaises(InvalidWebhookSignature):
            WompiClient().validate_event(payload)

    @override_settings(
        WOMPI_BASE_URL="https://checkout.wompi.co/l/not-an-api-base-url"
    )
    def test_wompi_configuration_rejects_checkout_link_as_api_url(self):
        with self.assertRaises(PaymentConfigurationError):
            WompiClient()

    @override_settings(WOMPI_PRIVATE_KEY="")
    def test_wompi_configuration_requires_private_key(self):
        with self.assertRaises(PaymentConfigurationError):
            WompiClient()
