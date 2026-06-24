import re
from decimal import Decimal

from django.test import TestCase

from apps.commerce.infrastructure.models import Order
from apps.customers.infrastructure.models import Customer


class OrderNumberTests(TestCase):
    def test_new_orders_use_short_readable_number(self):
        customer = Customer.objects.create(
            document_number="900123456",
            first_name="Armando",
            last_name="Peña",
            email="armando@example.com",
        )

        order = Order.objects.create(
            customer=customer,
            subtotal=Decimal("10000"),
            total=Decimal("10000"),
            shipping_address="Calle 7, Baranoa",
        )

        self.assertRegex(order.number, re.compile(r"^JR-[A-Z0-9]{6}$"))
