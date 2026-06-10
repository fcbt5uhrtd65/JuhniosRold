from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.catalog.infrastructure.models import Category, Price, Product, ProductVariant
from apps.inventory.application.use_cases import RegisterInventoryMovement
from apps.inventory.infrastructure.models import InventoryMovement, Location, Stock, Warehouse
from shared.domain.exceptions import BusinessRuleViolation


class InventoryMovementTests(TestCase):
    def setUp(self):
        category = Category.objects.create(name="Cuidado capilar", slug="cuidado-capilar")
        product = Product.objects.create(category=category, name="Shampoo", slug="shampoo")
        self.variant = ProductVariant.objects.create(product=product, sku="SHA-001", name="500 ml")
        Price.objects.create(
            variant=self.variant,
            amount=Decimal("35000"),
            valid_from=timezone.now(),
        )
        warehouse = Warehouse.objects.create(name="Principal", code="MAIN")
        self.location = Location.objects.create(warehouse=warehouse, name="Ventas", code="SALE")
        self.use_case = RegisterInventoryMovement()

    def test_entry_and_exit_update_stock(self):
        self.use_case.execute(
            variant=self.variant,
            location=self.location,
            movement_type=InventoryMovement.Type.ENTRY,
            quantity=Decimal("10"),
        )
        self.use_case.execute(
            variant=self.variant,
            location=self.location,
            movement_type=InventoryMovement.Type.EXIT,
            quantity=Decimal("3"),
        )
        stock = Stock.objects.get(variant=self.variant, location=self.location)
        self.assertEqual(stock.quantity, Decimal("7"))

    def test_exit_rejects_insufficient_stock(self):
        with self.assertRaises(BusinessRuleViolation):
            self.use_case.execute(
                variant=self.variant,
                location=self.location,
                movement_type=InventoryMovement.Type.EXIT,
                quantity=Decimal("1"),
            )
