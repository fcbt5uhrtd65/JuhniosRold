"""Clasificación automática de horas extra/recargo según la normativa laboral
colombiana vigente (Ley 2466 de 2025 y reforma laboral de 2025).

Reglas aplicadas:
- Jornada diurna: 6:00 a.m. a 7:00 p.m. Jornada nocturna: 7:00 p.m. a 6:00 a.m.
  El horario nocturno ampliado (desde las 7 p.m., antes 9 p.m.) rige desde el
  25 de diciembre de 2025.
- Recargos de lunes a sábado (el sábado no tiene recargo especial por sí solo):
    hora ordinaria diurna    0 %   -> 100 % del valor hora
    hora ordinaria nocturna 35 %   -> 135 %
    hora extra diurna       25 %   -> 125 %
    hora extra nocturna     75 %   -> 175 %
- Domingo o día de descanso obligatorio (se asume domingo, salvo pacto escrito
  distinto, que este sistema no modela todavía): recargo adicional del 90 %
  desde el 1 de julio de 2026 (100 % desde julio de 2027), acumulado sobre los
  recargos anteriores:
    dominical diurna ordinaria   90 %        -> 190 %
    dominical nocturna ordinaria 90+35=125 % -> 225 %
    dominical extra diurna       90+25=115 % -> 215 %
    dominical extra nocturna     90+75=165 % -> 265 %
- Festivos entre semana no se clasifican todavía (no existe catálogo de
  festivos colombianos en el sistema); solo se distingue domingo.

Esta clasificación es informativa para el Excel de RRHH — no calcula valores
en pesos, solo el tipo de hora y su porcentaje de recargo total.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

NIGHT_SCHEDULE_EFFECTIVE_DATE = date(2025, 12, 25)
SUNDAY_SURCHARGE_90_EFFECTIVE_DATE = date(2026, 7, 1)
SUNDAY_SURCHARGE_100_EFFECTIVE_DATE = date(2027, 7, 1)

DAY_START = time(6, 0)
NIGHT_START_CURRENT = time(19, 0)
NIGHT_START_LEGACY = time(21, 0)


def _night_start_for(day: date) -> time:
    return NIGHT_START_CURRENT if day >= NIGHT_SCHEDULE_EFFECTIVE_DATE else NIGHT_START_LEGACY


def _sunday_surcharge_pct(day: date) -> Decimal:
    if day >= SUNDAY_SURCHARGE_100_EFFECTIVE_DATE:
        return Decimal("100")
    if day >= SUNDAY_SURCHARGE_90_EFFECTIVE_DATE:
        return Decimal("90")
    return Decimal("0")


def _split_points(day: date) -> list[time]:
    """Puntos de corte horario dentro de un día dado (inicio diurno y nocturno)."""
    night_start = _night_start_for(day)
    points = {time(0, 0), DAY_START, night_start}
    return sorted(points)


def _classify_segment(
    day: date, segment_start: time, is_extra: bool, holiday_dates: frozenset[date] | None = None
) -> tuple[str, Decimal, bool]:
    """Clasifica un segmento horario (que no cruza medianoche ni un punto de
    corte diurno/nocturno) y devuelve (etiqueta, porcentaje total de recargo,
    es_nocturno).

    ``holiday_dates`` es un conjunto opcional de fechas festivas (ver
    holiday_calendar.py / PublicHoliday). En Colombia un festivo entre semana
    recibe el mismo recargo que un domingo, así que se trata como día de
    descanso obligatorio igual que domingo. Si no se pasa (o es None), el
    comportamiento es idéntico al de antes de este parámetro: solo domingo
    cuenta como día de descanso."""
    night_start = _night_start_for(day)
    is_night = segment_start >= night_start or segment_start < DAY_START
    is_sunday = day.weekday() == 6
    is_holiday = bool(holiday_dates) and day in holiday_dates
    is_rest_day = is_sunday or is_holiday
    sunday_pct = _sunday_surcharge_pct(day) if is_rest_day else Decimal("0")

    if is_rest_day and sunday_pct > 0:
        if is_extra:
            pct = sunday_pct + (Decimal("75") if is_night else Decimal("25"))
            label = "Extra nocturna dominical" if is_night else "Extra diurna dominical"
        else:
            pct = sunday_pct + (Decimal("35") if is_night else Decimal("0"))
            label = "Dominical nocturna ordinaria" if is_night else "Dominical diurna ordinaria"
        return label, pct, is_night

    if is_extra:
        pct = Decimal("75") if is_night else Decimal("25")
        label = "Extra nocturna" if is_night else "Extra diurna"
    else:
        pct = Decimal("35") if is_night else Decimal("0")
        label = "Ordinaria nocturna" if is_night else "Ordinaria diurna"
    return label, pct, is_night


def classify_shift(
    start_dt: datetime, end_dt: datetime, is_extra: bool = True, holiday_dates: frozenset[date] | None = None
) -> list[dict]:
    """Divide un turno [start_dt, end_dt) en segmentos según los cortes de
    medianoche, 6 a.m. y el inicio nocturno vigente, clasifica cada uno y
    devuelve la lista de segmentos con sus minutos y % de recargo.

    ``is_extra`` indica si todo el turno se considera hora extra (por defecto,
    ya que esta función se usa sobre solicitudes de tipo Horas Extra); para
    horas ordinarias con recargo nocturno/dominical se puede pasar False.

    ``holiday_dates`` (opcional) es un conjunto de fechas festivas — ver
    holiday_calendar.py / PublicHoliday. Si se omite, el comportamiento es
    exactamente el de antes de este parámetro (solo domingo cuenta como día
    de descanso obligatorio); los llamadores existentes no necesitan cambiar.
    """
    if end_dt <= start_dt:
        return []

    segments = []
    cursor = start_dt
    while cursor < end_dt:
        day = cursor.date()
        day_end = datetime.combine(day + timedelta(days=1), time(0, 0))
        chunk_end = min(end_dt, day_end)

        cuts = [datetime.combine(day, t) for t in _split_points(day)]
        cuts = [c for c in cuts if cursor < c < chunk_end]
        boundaries = [cursor] + cuts + [chunk_end]

        for seg_start, seg_end in zip(boundaries, boundaries[1:]):
            if seg_end <= seg_start:
                continue
            label, pct, is_night = _classify_segment(day, seg_start.time(), is_extra, holiday_dates)
            minutes = int((seg_end - seg_start).total_seconds() // 60)
            segments.append({"label": label, "surcharge_pct": pct, "minutes": minutes, "is_night": is_night})
        cursor = chunk_end

    return segments


def hours_breakdown(
    start_dt: datetime, end_dt: datetime, is_extra: bool = True, holiday_dates: frozenset[date] | None = None
) -> dict:
    """Total de horas diurnas y nocturnas de un turno (en horas decimales,
    ej. 2.5), más el total general — para columnas separadas del Excel."""
    segments = classify_shift(start_dt, end_dt, is_extra=is_extra, holiday_dates=holiday_dates)
    day_minutes = sum(seg["minutes"] for seg in segments if not seg["is_night"])
    night_minutes = sum(seg["minutes"] for seg in segments if seg["is_night"])
    return {
        "day_hours": round(day_minutes / 60, 2),
        "night_hours": round(night_minutes / 60, 2),
        "total_hours": round((day_minutes + night_minutes) / 60, 2),
    }


def summarize_shift(
    start_dt: datetime, end_dt: datetime, is_extra: bool = True, holiday_dates: frozenset[date] | None = None
) -> str:
    """Texto legible del desglose de un turno, ej.:
    'Extra diurna 125% (1h 30m); Extra nocturna 175% (1h)'."""
    segments = classify_shift(start_dt, end_dt, is_extra=is_extra, holiday_dates=holiday_dates)
    if not segments:
        return "-"

    merged: dict[tuple[str, str], int] = {}
    for seg in segments:
        key = (seg["label"], f"{100 + seg['surcharge_pct']:.0f}%")
        merged[key] = merged.get(key, 0) + seg["minutes"]

    parts = []
    for (label, pct_label), minutes in merged.items():
        hours, mins = divmod(minutes, 60)
        duration = f"{hours}h" + (f" {mins}m" if mins else "")
        parts.append(f"{label} {pct_label} ({duration})")
    return "; ".join(parts)
