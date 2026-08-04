from decimal import Decimal
from datetime import datetime, time
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.employees.infrastructure.models import Employee
from apps.human_resources.application.use_cases import (
    AddManualPayrollItem,
    ApprovePayrollPeriod,
    CalculateEmployeePayrollForPeriod,
    CalculatePayrollPeriod,
)
from apps.human_resources.infrastructure.models import (
    Attendance,
    EmployeeWorkSchedule,
    EmployeeWorkScheduleDay,
    PayrollItem,
    PayrollLegalParameter,
    PayrollPeriod,
)
from shared.domain.exceptions import BusinessRuleViolation


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

    def test_attendance_payroll_always_discounts_one_lunch_hour(self):
        employee = Employee.objects.create(
            employee_code="EMP-LUNCH-001",
            first_name="Almuerzo",
            last_name="Fijo",
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
            label="Nomina almuerzo fijo",
        )
        Attendance.objects.create(
            employee=employee,
            date="2026-04-20",
            check_in=timezone.make_aware(datetime(2026, 4, 20, 7, 0)),
            break_start=timezone.make_aware(datetime(2026, 4, 20, 12, 0)),
            break_end=timezone.make_aware(datetime(2026, 4, 20, 12, 30)),
            check_out=timezone.make_aware(datetime(2026, 4, 20, 18, 0)),
            source=Attendance.Source.BIOMETRIC,
        )

        payroll = CalculateEmployeePayrollForPeriod().execute(period=period, employee=employee)
        overtime_item = payroll.items.get(concept_code="OVERTIME_DAY")

        self.assertEqual(payroll.ordinary_hours, Decimal("9.00"))
        self.assertEqual(payroll.overtime_hours, Decimal("1.00"))
        self.assertEqual(overtime_item.amount, Decimal("9948.32"))

    def test_manual_payroll_item_does_not_double_count_base_salary(self):
        employee = Employee.objects.create(
            employee_code="EMP-LEGACY-206",
            first_name="Alexandra",
            last_name="Prueba",
            base_salary=Decimal("3000"),
            status=Employee.Status.ACTIVE,
        )
        period = PayrollPeriod.objects.create(
            period_start="2026-04-20",
            period_end="2026-04-20",
            label="Nomina prueba ajuste",
        )

        payroll = CalculateEmployeePayrollForPeriod().execute(period=period, employee=employee)
        AddManualPayrollItem().execute(
            payroll=payroll,
            item_type=PayrollItem.Type.EARNING,
            concept="Bono puntual",
            amount=Decimal("10"),
        )
        payroll.refresh_from_db()

        self.assertEqual(payroll.gross_earnings, Decimal("110.00"))
        self.assertEqual(payroll.net_salary, Decimal("110.00"))

    def test_calculate_period_with_employee_errors_stays_open(self):
        employee = Employee.objects.create(
            employee_code="EMP-LEGACY-207",
            first_name="Alexandra",
            last_name="Prueba",
            base_salary=Decimal("3000"),
            status=Employee.Status.ACTIVE,
        )
        period = PayrollPeriod.objects.create(
            period_start="2026-04-20",
            period_end="2026-04-21",
            label="Nomina prueba error",
        )

        with patch(
            "apps.human_resources.application.use_cases.CalculateEmployeePayrollForPeriod.execute",
            side_effect=BusinessRuleViolation("Faltan datos de prueba"),
        ):
            result = CalculatePayrollPeriod().execute(period=period, employee_queryset=Employee.objects.filter(id=employee.id))

        period.refresh_from_db()
        self.assertEqual(result["calculated"], 0)
        self.assertEqual(len(result["errors"]), 1)
        self.assertEqual(period.status, PayrollPeriod.Status.OPEN)

    def test_approve_period_requires_all_active_employees_calculated(self):
        employee = Employee.objects.create(
            employee_code="EMP-LEGACY-208",
            first_name="Alexandra",
            last_name="Prueba",
            base_salary=Decimal("3000"),
            status=Employee.Status.ACTIVE,
        )
        Employee.objects.create(
            employee_code="EMP-LEGACY-209",
            first_name="Carlos",
            last_name="Pendiente",
            base_salary=Decimal("3000"),
            status=Employee.Status.ACTIVE,
        )
        period = PayrollPeriod.objects.create(
            period_start="2026-04-20",
            period_end="2026-04-21",
            label="Nomina prueba parcial",
            status=PayrollPeriod.Status.CALCULATED,
        )
        CalculateEmployeePayrollForPeriod().execute(period=period, employee=employee)
        period.status = PayrollPeriod.Status.CALCULATED
        period.save(update_fields=("status", "updated_at"))

        with self.assertRaises(BusinessRuleViolation):
            ApprovePayrollPeriod().execute(period=period)
