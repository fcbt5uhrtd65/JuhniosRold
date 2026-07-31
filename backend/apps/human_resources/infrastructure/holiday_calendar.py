"""Generación del calendario de festivos colombianos por año.

Funciones puras, sin dependencia de Django models — el resultado se usa para
pre-poblar la tabla editable `PublicHoliday` (ver GenerateYearHolidays en
application/use_cases.py), no para calcular festivos en tiempo real en cada
consulta.

Reglas aplicadas:
- Festivos de fecha fija que SIEMPRE se celebran ese día exacto (Año Nuevo,
  Día del Trabajo, Independencia, Batalla de Boyacá, Inmaculada Concepción,
  Navidad).
- Festivos de fecha fija que la Ley Emiliani (Ley 51 de 1983) traslada al
  lunes siguiente cuando no caen en lunes.
- Festivos basados en la fecha de Semana Santa (Pascua), algunos de los
  cuales también se trasladan al lunes siguiente por la misma ley.
"""

from datetime import date, timedelta


def _easter_sunday(year: int) -> date:
    """Domingo de Pascua para un año dado (algoritmo de Meeus/Jones/Butcher,
    calendario gregoriano)."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _next_monday_on_or_after(day: date) -> date:
    """Ley Emiliani: si el festivo no cae en lunes, se traslada al lunes
    siguiente. weekday(): 0=lunes."""
    offset = (7 - day.weekday()) % 7
    return day + timedelta(days=offset)


def generate_colombian_holidays(year: int) -> list[dict]:
    """Devuelve la lista de festivos colombianos de un año, con la fecha civil
    ya resuelta (traslado a lunes aplicado si corresponde). Cada elemento:
    {"name", "kind", "civil_date", "original_date"} — listo para crear
    PublicHoliday vía update_or_create."""
    easter = _easter_sunday(year)

    fixed_no_move = [
        ("Año Nuevo", date(year, 1, 1)),
        ("Día del Trabajo", date(year, 5, 1)),
        ("Independencia de Colombia", date(year, 7, 20)),
        ("Batalla de Boyacá", date(year, 8, 7)),
        ("Inmaculada Concepción", date(year, 12, 8)),
        ("Navidad", date(year, 12, 25)),
    ]

    fixed_moved = [
        ("Reyes Magos", date(year, 1, 6)),
        ("San José", date(year, 3, 19)),
        ("San Pedro y San Pablo", date(year, 6, 29)),
        ("Asunción de la Virgen", date(year, 8, 15)),
        ("Día de la Raza", date(year, 10, 12)),
        ("Todos los Santos", date(year, 11, 1)),
        ("Independencia de Cartagena", date(year, 11, 11)),
    ]

    easter_based_no_move = [
        ("Jueves Santo", easter - timedelta(days=3)),
        ("Viernes Santo", easter - timedelta(days=2)),
    ]

    easter_based_moved = [
        ("Ascensión del Señor", easter + timedelta(days=39)),
        ("Corpus Christi", easter + timedelta(days=60)),
        ("Sagrado Corazón de Jesús", easter + timedelta(days=68)),
    ]

    holidays: list[dict] = []

    for name, original in fixed_no_move:
        holidays.append({
            "name": name,
            "kind": "FIXED",
            "civil_date": original,
            "original_date": None,
        })

    for name, original in fixed_moved:
        civil = _next_monday_on_or_after(original)
        holidays.append({
            "name": name,
            "kind": "FIXED_MOVED_TO_MONDAY",
            "civil_date": civil,
            "original_date": original if civil != original else None,
        })

    for name, original in easter_based_no_move:
        holidays.append({
            "name": name,
            "kind": "EASTER_BASED",
            "civil_date": original,
            "original_date": None,
        })

    for name, original in easter_based_moved:
        civil = _next_monday_on_or_after(original)
        holidays.append({
            "name": name,
            "kind": "EASTER_BASED",
            "civil_date": civil,
            "original_date": original if civil != original else None,
        })

    holidays.sort(key=lambda h: h["civil_date"])
    return holidays
