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


def test_close_duplicate_entry_is_ignored_before_inferring_day_shift():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 5, 4), 6, 30),
        dated_punch((2026, 5, 4), 6, 30),
        dated_punch((2026, 5, 4), 12, 25),
        dated_punch((2026, 5, 4), 13, 28),
        dated_punch((2026, 5, 4), 16, 35),
    ])

    assert result["check_in"] == datetime(2026, 5, 4, 6, 30)
    assert result["break_start"] == datetime(2026, 5, 4, 12, 25)
    assert result["break_end"] == datetime(2026, 5, 4, 13, 28)
    assert result["check_out"] == datetime(2026, 5, 4, 16, 35)
    assert result["has_incomplete_marks"] is False


def test_unsorted_extra_morning_mark_keeps_earliest_entry_and_lunch_pair():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 5, 4), 8, 16),
        dated_punch((2026, 5, 4), 12, 41),
        dated_punch((2026, 5, 4), 13, 40),
        dated_punch((2026, 5, 4), 17, 50),
        dated_punch((2026, 5, 4), 7, 24),
    ])

    assert result["check_in"] == datetime(2026, 5, 4, 7, 24)
    assert result["break_start"] == datetime(2026, 5, 4, 12, 41)
    assert result["break_end"] == datetime(2026, 5, 4, 13, 40)
    assert result["check_out"] == datetime(2026, 5, 4, 17, 50)
    assert result["has_incomplete_marks"] is True


def test_early_day_entry_with_extra_morning_mark_keeps_day_shift():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 5, 4), 8, 32),
        dated_punch((2026, 5, 4), 14, 38),
        dated_punch((2026, 5, 4), 15, 27),
        dated_punch((2026, 5, 4), 17, 54),
        dated_punch((2026, 5, 4), 7, 26),
    ])

    assert result["check_in"] == datetime(2026, 5, 4, 7, 26)
    assert result["break_start"] == datetime(2026, 5, 4, 14, 38)
    assert result["break_end"] == datetime(2026, 5, 4, 15, 27)
    assert result["check_out"] == datetime(2026, 5, 4, 17, 54)
    assert result["has_incomplete_marks"] is True


def test_duplicate_morning_mark_four_minutes_apart_is_ignored():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 5, 4), 6, 47),
        dated_punch((2026, 5, 4), 12, 0),
        dated_punch((2026, 5, 4), 12, 59),
        dated_punch((2026, 5, 4), 16, 32),
        dated_punch((2026, 5, 4), 6, 51),
    ])

    assert result["check_in"] == datetime(2026, 5, 4, 6, 47)
    assert result["break_start"] == datetime(2026, 5, 4, 12, 0)
    assert result["break_end"] == datetime(2026, 5, 4, 12, 59)
    assert result["check_out"] == datetime(2026, 5, 4, 16, 32)
    assert result["has_incomplete_marks"] is False


def test_three_marks_with_lunch_pair_do_not_invent_work_checkout():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 7, 29), 5, 42),
        dated_punch((2026, 7, 29), 12, 16),
        dated_punch((2026, 7, 29), 13, 18),
    ])

    assert result["check_in"] == datetime(2026, 7, 29, 5, 42)
    assert result["break_start"] == datetime(2026, 7, 29, 12, 16)
    assert result["break_end"] == datetime(2026, 7, 29, 13, 18)
    assert result["check_out"] is None
    assert result["has_incomplete_marks"] is True


def test_three_marks_with_initial_lunch_pair_do_not_invent_work_checkin():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 8, 12), 11, 20),
        dated_punch((2026, 8, 12), 12, 23),
        dated_punch((2026, 8, 12), 18, 2),
    ])

    assert result["check_in"] is None
    assert result["break_start"] == datetime(2026, 8, 12, 11, 20)
    assert result["break_end"] == datetime(2026, 8, 12, 12, 23)
    assert result["check_out"] == datetime(2026, 8, 12, 18, 2)
    assert result["has_incomplete_marks"] is True


def test_early_morning_day_entry_with_extra_mark_keeps_last_day_checkout():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 8, 10), 7, 58),
        dated_punch((2026, 8, 10), 12, 18),
        dated_punch((2026, 8, 10), 13, 19),
        dated_punch((2026, 8, 10), 18, 7),
        dated_punch((2026, 8, 10), 5, 47),
    ])

    assert result["check_in"] == datetime(2026, 8, 10, 5, 47)
    assert result["break_start"] == datetime(2026, 8, 10, 12, 18)
    assert result["break_end"] == datetime(2026, 8, 10, 13, 19)
    assert result["check_out"] == datetime(2026, 8, 10, 18, 7)
    assert result["has_incomplete_marks"] is True


def test_early_morning_entry_with_same_day_lunch_is_day_shift():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 5, 4), 11, 6),
        dated_punch((2026, 5, 4), 12, 0),
        dated_punch((2026, 5, 4), 18, 6),
        dated_punch((2026, 5, 4), 5, 43),
    ])

    assert result["check_in"] == datetime(2026, 5, 4, 5, 43)
    assert result["break_start"] == datetime(2026, 5, 4, 11, 6)
    assert result["break_end"] == datetime(2026, 5, 4, 12, 0)
    assert result["check_out"] == datetime(2026, 5, 4, 18, 6)
    assert result["has_incomplete_marks"] is False


@pytest.mark.django_db
def test_same_day_day_shift_evidence_wins_over_previous_night_schedule():
    employee = Employee.objects.create(employee_code="MIXED-001", first_name="Mixto", status=Employee.Status.ACTIVE)
    schedule = EmployeeWorkSchedule.objects.create(employee=employee, start_date="2026-04-01")
    EmployeeWorkScheduleDay.objects.create(
        schedule=schedule,
        weekday=3,
        slot=1,
        expected_start_time=time(18, 0),
        expected_end_time=time(6, 0),
    )
    service = ConsolidateAttendanceFromPunches()
    punches = [
        dated_punch((2026, 5, 1), 5, 43, employee=employee),
        dated_punch((2026, 5, 1), 11, 6, employee=employee),
        dated_punch((2026, 5, 1), 12, 0, employee=employee),
        dated_punch((2026, 5, 1), 18, 6, employee=employee),
    ]

    grouped = service._group_punches_by_operational_day(punches, {})

    assert (employee.id, datetime(2026, 5, 1).date()) in grouped
    assert (employee.id, datetime(2026, 4, 30).date()) not in grouped


@pytest.mark.django_db
def test_early_day_entry_with_extra_mark_wins_over_previous_night_schedule():
    employee = Employee.objects.create(employee_code="MIXED-002", first_name="Mixto", status=Employee.Status.ACTIVE)
    schedule = EmployeeWorkSchedule.objects.create(employee=employee, start_date="2026-04-01")
    EmployeeWorkScheduleDay.objects.create(
        schedule=schedule,
        weekday=6,
        slot=1,
        expected_start_time=time(18, 0),
        expected_end_time=time(6, 0),
    )
    service = ConsolidateAttendanceFromPunches()
    punches = [
        dated_punch((2026, 5, 4), 8, 32, employee=employee),
        dated_punch((2026, 5, 4), 14, 38, employee=employee),
        dated_punch((2026, 5, 4), 15, 27, employee=employee),
        dated_punch((2026, 5, 4), 17, 54, employee=employee),
        dated_punch((2026, 5, 4), 7, 26, employee=employee),
    ]

    grouped = service._group_punches_by_operational_day(punches, {})

    assert (employee.id, datetime(2026, 5, 4).date()) in grouped
    assert (employee.id, datetime(2026, 5, 3).date()) not in grouped


def test_impossible_shift_duration_is_marked_incomplete():
    service = ConsolidateAttendanceFromPunches()

    result = service._infer_attendance([
        dated_punch((2026, 5, 4), 6, 30),
        dated_punch((2026, 5, 5), 10, 30),
    ])

    assert result["check_in"] == datetime(2026, 5, 4, 6, 30)
    assert result["check_out"] == datetime(2026, 5, 5, 10, 30)
    assert result["has_incomplete_marks"] is True


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
