import unittest

from apps.human_resources.infrastructure.payroll_engine import round_ordinary_minutes


class OrdinaryHoursRoundingTests(unittest.TestCase):
    def test_excel_threshold_and_non_negative_result(self):
        for minutes, expected in [
            (-1, 0), (0, 0), (24, 0), (25, 30), (30, 30), (59, 30),
            (60, 60), (504, 480), (505, 510), (539, 510),
            (540, 540), (630, 630), (1470, 1470),
        ]:
            with self.subTest(minutes=minutes):
                self.assertEqual(round_ordinary_minutes(minutes), expected)

    def test_round_each_day_before_adding_period_totals(self):
        self.assertEqual(sum(round_ordinary_minutes(m) for m in [504, 504]), 960)
        self.assertEqual(sum(round_ordinary_minutes(m) for m in [505, 505]), 1020)
