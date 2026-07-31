"""Helpers de cálculo del motor de nómina — funciones casi-puras (consultan
el ORM pero no escriben nada), separadas de la orquestación transaccional
que vive en application/use_cases.py (CalculateEmployeePayrollForPeriod).

Alcance mínimo v1 documentado aquí junto a cada función: qué se calcula
automáticamente y qué se deja explícitamente fuera (ver también el plan de
diseño del módulo)."""

from decimal import ROUND_HALF_UP, Decimal

DEFAULT_MONTHLY_HOURS_DIVISOR = Decimal("230")
LEGAL_DAY_HOURS = Decimal("30")  # días de mes estándar colombiano para liquidaciones (salario/30)


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def resolve_base_salary(employee, reference_date) -> Decimal:
    """Salario base vigente para un empleado en una fecha dada: si hay
    EmployeeSalaryHistory aplicable a esa fecha, se usa esa cifra (permite
    liquidar retroactivamente con el salario correcto de la época); si no,
    se cae a employee.base_salary."""
    history_entry = (
        employee.salary_history.filter(start_date__lte=reference_date).order_by("-start_date").first()
        if hasattr(employee, "salary_history")
        else None
    )
    if history_entry:
        return Decimal(history_entry.new_salary)
    return Decimal(employee.base_salary)


def resolve_monthly_hours_divisor(employee, legal_parameter=None) -> Decimal:
    """Divisor de horas mensuales para calcular el valor de la hora.
    Prioriza weekly_working_hours del empleado (dato específico ya
    capturado por el sistema); si no está definido, cae al parámetro legal
    del año (PayrollLegalParameter.monthly_hours_divisor_default) o, en su
    defecto, a la constante DEFAULT_MONTHLY_HOURS_DIVISOR."""
    weekly_hours = getattr(employee, "weekly_working_hours", None)
    if weekly_hours:
        return Decimal(weekly_hours) * Decimal(52) / Decimal(12)
    if legal_parameter and legal_parameter.monthly_hours_divisor_default:
        return Decimal(legal_parameter.monthly_hours_divisor_default)
    return DEFAULT_MONTHLY_HOURS_DIVISOR


def hourly_rate_for(employee, reference_date, legal_parameter=None) -> Decimal:
    """Valor de la hora ordinaria de un empleado en una fecha dada.

    Alcance v1: salary_type=INTEGRAL se calcula igual sobre el salario
    integral completo, SIN desglosar el factor prestacional (~30%) que ya
    incorpora por ley — se deja como limitación conocida, documentada.
    salary_type=VARIABLE se trata como si fuera fijo (no hay datos de
    comisiones/ventas en el sistema) — también limitación conocida v1."""
    base_salary = resolve_base_salary(employee, reference_date)
    divisor = resolve_monthly_hours_divisor(employee, legal_parameter)
    if divisor <= 0:
        return Decimal("0")
    return _quantize(base_salary / divisor)


def daily_rate_for(employee, reference_date) -> Decimal:
    """Valor del día para liquidar vacaciones/incapacidades/permisos no
    remunerados: salario mensual / 30 (estándar colombiano de mes comercial
    de 30 días para liquidaciones, distinto del divisor de horas)."""
    base_salary = resolve_base_salary(employee, reference_date)
    return _quantize(base_salary / LEGAL_DAY_HOURS)


def transport_allowance_for(employee, legal_parameter) -> Decimal:
    """Auxilio de transporte del período (valor mensual completo — el
    prorrateo por días trabajados del período, si aplica, lo decide el
    llamador). Solo aplica si transport_allowance_applies=True Y el salario
    base no excede el tope configurado (por defecto 2 SMMLV)."""
    if not getattr(employee, "transport_allowance_applies", False):
        return Decimal("0")
    if not legal_parameter:
        return Decimal("0")
    cap = Decimal(legal_parameter.minimum_wage) * Decimal(legal_parameter.transport_allowance_salary_cap_factor)
    base_salary = Decimal(employee.base_salary)
    if base_salary > cap:
        return Decimal("0")
    return Decimal(legal_parameter.transport_allowance_amount)


def health_deduction_for(base_salary: Decimal, legal_parameter) -> Decimal:
    """Salud a cargo del empleado (v1: porcentaje simple sobre el salario
    base, SIN tope de 25 SMMLV — fuera de alcance v1, documentado)."""
    if not legal_parameter:
        return Decimal("0")
    pct = Decimal(legal_parameter.health_employee_pct) / Decimal(100)
    return _quantize(base_salary * pct)


def pension_deduction_for(base_salary: Decimal, legal_parameter) -> Decimal:
    """Pensión a cargo del empleado (misma limitación v1 que salud: sin
    tope de 25 SMMLV)."""
    if not legal_parameter:
        return Decimal("0")
    pct = Decimal(legal_parameter.pension_employee_pct) / Decimal(100)
    return _quantize(base_salary * pct)
