from datetime import datetime
from types import SimpleNamespace

from apps.human_resources.application.use_cases import (
    ConsolidateAttendanceFromPunches,
    biometric_punch_action,
)


def punch(at, raw_col3="", raw_col4="", raw_col5="", raw_col6=""):
    return SimpleNamespace(
        punched_at=datetime(2026, 4, 14, at[0], at[1]),
        raw_col3=raw_col3,
        raw_col4=raw_col4,
        raw_col5=raw_col5,
        raw_col6=raw_col6,
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
