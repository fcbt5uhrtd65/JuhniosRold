from decimal import Decimal

from django.test import SimpleTestCase

from apps.human_resources.domain.entities import PayrollCalculation
from shared.domain.exceptions import BusinessRuleViolation
from shared.domain.value_objects import Money, Quantity


class ValueObjectTests(SimpleTestCase):
    def test_money_rejects_negative_amounts(self):
        with self.assertRaises(BusinessRuleViolation):
            Money(Decimal("-1"))

    def test_quantity_rejects_negative_values(self):
        with self.assertRaises(BusinessRuleViolation):
            Quantity(Decimal("-0.001"))

    def test_payroll_calculates_net_salary(self):
        payroll = PayrollCalculation(
            base_salary=Decimal("2000000"),
            bonuses=Decimal("200000"),
            deductions=Decimal("150000"),
        )
        self.assertEqual(payroll.net_salary, Decimal("2050000"))
