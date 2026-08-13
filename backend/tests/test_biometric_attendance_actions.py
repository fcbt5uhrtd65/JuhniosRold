from datetime import datetime, time
from types import SimpleNamespace

import pytest

from apps.employees.infrastructure.models import Employee
from apps.human_resources.application.use_cases import (
    ConsolidateAttendanceFromPunches,
    biometric_punch_action,
)
from apps.human_resources.infrastructure.models import EmployeeWorkSchedule, EmployeeWorkScheduleDay


def punch(at, raw_col3="", raw_col4="", raw_col5="", raw_col6=""):
    return SimpleNamespace(
        punched_at=datetime(2026, 4, 14, at[0], at[1]),
        raw_col3=raw_col3,
        raw_col4=raw_col4,
        raw_col5=raw_col5,
        raw_col6=raw_col6,
    )


def dated_punch(day, hour, minute, employee=None):
    return SimpleNamespace(
        punched_at=datetime(day[0], day[1], day[2], hour, minute),
        matched_employee_id=getattr(employee, "id", "emp-1"),
        matched_employee=employee,
        raw_col3="",
        raw_col4="",
        raw_col5="",
        raw_col6="",
    )


def test_biometric_action_text_maps_to_attendance_fields():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        punch((7, 16), "ENTRADA"),
        punch((12, 2), "INICIO ALMUERZO"),
        punch((12, 41), "FIN ALMUERZO"),
        punch((17, 35), "SALIDA"),
    ])

    assert result["check_in"] == datetime(2026, 4, 14, 7, 16)
    assert result["break_start"] == datetime(2026, 4, 14, 12, 2)
    assert result["break_end"] == datetime(2026, 4, 14, 12, 41)
    assert result["check_out"] == datetime(2026, 4, 14, 17, 35)
    assert result["has_incomplete_marks"] is False


def test_single_numeric_action_column_uses_one_to_four_action_order():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        punch((7, 16), "1"),
        punch((12, 2), "3"),
        punch((12, 41), "4"),
        punch((17, 35), "2"),
    ])

    assert result["check_in"] == datetime(2026, 4, 14, 7, 16)
    assert result["break_start"] == datetime(2026, 4, 14, 12, 2)
    assert result["break_end"] == datetime(2026, 4, 14, 12, 41)
    assert result["check_out"] == datetime(2026, 4, 14, 17, 35)
    assert result["has_incomplete_marks"] is False


def test_ambiguous_legacy_numeric_columns_do_not_force_action():
    raw_punch = punch((7, 16), "1", "0", "1", "0")

    assert biometric_punch_action(raw_punch) is None


def test_night_shift_rest_break_in_early_morning_is_detected():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 4, 30), 18, 0),
        dated_punch((2026, 5, 1), 2, 0),
        dated_punch((2026, 5, 1), 3, 0),
        dated_punch((2026, 5, 1), 6, 0),
    ])

    assert result["check_in"] == datetime(2026, 4, 30, 18, 0)
    assert result["break_start"] == datetime(2026, 5, 1, 2, 0)
    assert result["break_end"] == datetime(2026, 5, 1, 3, 0)
    assert result["check_out"] == datetime(2026, 5, 1, 6, 0)
    assert result["has_incomplete_marks"] is False


def test_only_early_morning_rest_break_stays_incomplete():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 5, 1), 2, 0),
        dated_punch((2026, 5, 1), 3, 0),
    ])

    assert result["check_in"] is None
    assert result["check_out"] is None
    assert result["break_start"] == datetime(2026, 5, 1, 2, 0)
    assert result["break_end"] == datetime(2026, 5, 1, 3, 0)
    assert result["has_incomplete_marks"] is True


@pytest.mark.django_db
def test_early_morning_punch_uses_previous_day_when_schedule_crosses_midnight():
    employee = Employee.objects.create(employee_code="NIGHT-001", first_name="Nocturno", status=Employee.Status.ACTIVE)
    schedule = EmployeeWorkSchedule.objects.create(employee=employee, start_date="2026-04-01")
    EmployeeWorkScheduleDay.objects.create(
        schedule=schedule,
        weekday=3,
        slot=1,
        expected_start_time=time(18, 0),
        expected_end_time=time(6, 0),
    )
    service = ConsolidateAttendanceFromPunches()

    day = service._scheduled_operational_day(
        dated_punch((2026, 5, 1), 3, 0, employee=employee),
        employee,
    )

    assert str(day) == "2026-04-30"
