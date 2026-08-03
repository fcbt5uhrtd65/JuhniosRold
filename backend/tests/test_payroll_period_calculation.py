from decimal import Decimal
from datetime import datetime, time

from django.test import TestCase
from django.utils import timezone

from apps.employees.infrastructure.models import Employee
from apps.human_resources.application.use_cases import CalculateEmployeePayrollForPeriod
from apps.human_resources.infrastructure.models import (
    Attendance,
    EmployeeWorkSchedule,
    EmployeeWorkScheduleDay,
    PayrollItem,
    PayrollLegalParameter,
    PayrollPeriod,
)


class PayrollPeriodCalculationTests(TestCase):
    def test_quincenal_payroll_prorates_base_salary_and_legal_deductions(self):
        employee = Employee.objects.create(
            employee_code="EMP-LEGACY-204",
            first_name="Alexandra",
            last_name="Prueba",
            base_salary=Decimal("1750905"),
            status=Employee.Status.ACTIVE,
        )
        period = PayrollPeriod.objects.create(
            period_start="2026-04-14",
            period_end="2026-04-27",
            label="Nomina 14-27 abril 2026",
        )
        PayrollLegalParameter.objects.create(
            year=2026,
            minimum_wage=Decimal("1423500"),
            transport_allowance_amount=Decimal("0"),
            health_employee_pct=Decimal("4"),
            pension_employee_pct=Decimal("4"),
            monthly_hours_divisor_default=Decimal("220"),
        )

        payroll = CalculateEmployeePayrollForPeriod().execute(period=period, employee=employee)
        base_item = payroll.items.get(concept_code="BASE_SALARY")

        self.assertEqual(base_item.item_type, PayrollItem.Type.EARNING)
        self.assertEqual(base_item.amount, Decimal("817089.00"))
        self.assertEqual(payroll.base_salary, Decimal("817089.00"))
        self.assertEqual(payroll.health_deduction, Decimal("32683.56"))
        self.assertEqual(payroll.pension_deduction, Decimal("32683.56"))
        self.assertEqual(payroll.net_salary, Decimal("751721.88"))

    def test_attendance_overtime_uses_schedule_and_excludes_lunch(self):
        employee = Employee.objects.create(
            employee_code="EMP-LEGACY-205",
            first_name="Alexandra",
            last_name="Prueba",
            base_salary=Decimal("1750905"),
            status=Employee.Status.ACTIVE,
        )
        PayrollLegalParameter.objects.create(
            year=2026,
            minimum_wage=Decimal("1423500"),
            transport_allowance_amount=Decimal("0"),
            health_employee_pct=Decimal("4"),
            pension_employee_pct=Decimal("4"),
            monthly_hours_divisor_default=Decimal("220"),
            day_extra_surcharge_pct=Decimal("25"),
        )
        schedule = EmployeeWorkSchedule.objects.create(employee=employee, start_date="2026-04-01")
        EmployeeWorkScheduleDay.objects.create(
            schedule=schedule,
            weekday=0,
            slot=1,
            expected_start_time=time(7, 0),
            expected_end_time=time(12, 0),
        )
        EmployeeWorkScheduleDay.objects.create(
            schedule=schedule,
            weekday=0,
            slot=2,
            expected_start_time=time(13, 0),
            expected_end_time=time(17, 0),
        )
        period = PayrollPeriod.objects.create(
            period_start="2026-04-20",
            period_end="2026-04-20",
            label="Nomina prueba extra",
        )
        Attendance.objects.create(
            employee=employee,
            date="2026-04-20",
            check_in=timezone.make_aware(datetime(2026, 4, 20, 7, 0)),
            break_start=timezone.make_aware(datetime(2026, 4, 20, 12, 0)),
            break_end=timezone.make_aware(datetime(2026, 4, 20, 13, 0)),
            check_out=timezone.make_aware(datetime(2026, 4, 20, 18, 0)),
            source=Attendance.Source.BIOMETRIC,
        )

        payroll = CalculateEmployeePayrollForPeriod().execute(period=period, employee=employee)
        overtime_item = payroll.items.get(concept_code="OVERTIME_DAY")

        self.assertEqual(payroll.ordinary_hours, Decimal("9.00"))
        self.assertEqual(payroll.overtime_hours, Decimal("1.00"))
        self.assertEqual(overtime_item.amount, Decimal("9948.32"))
