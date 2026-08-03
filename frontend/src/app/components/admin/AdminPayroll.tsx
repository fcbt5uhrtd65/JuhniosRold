import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Pencil,
  Plus,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  ActionsMenu,
  Badge,
  type BadgeColor,
  Card,
  EmptyState,
  KpiCard,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchBarAdmin,
  SecondaryButton,
  TabBar,
  inputCls,
  selectCls,
} from './AdminUI';
import {
  applyWorkScheduleTemplate,
  approvePayrollPeriod,
  calculatePayrollPeriod,
  correctAttendance,
  createBiometricDevice,
  createEmployeeBiometricId,
  createPayrollLegalParameter,
  createPayrollPeriod,
  createWorkScheduleTemplate,
  deleteEmployeeBiometricId,
  generateYearHolidays,
  getAttendanceIntelligenceSettings,
  getBiometricDevices,
  getEmployeeBiometricIds,
  getEmployeeWorkSchedules,
  getPayrollLegalParameters,
  getPayrollPeriods,
  getPendingCorrectionAttendance,
  getPublicHolidays,
  getUnmatchedBiometricCodes,
  getWorkScheduleTemplates,
  markPayrollPeriodPaid,
  setEmployeeWorkSchedule,
  updateAttendanceIntelligenceSettings,
  updatePayrollLegalParameter,
  updateWorkScheduleTemplate,
  uploadBiometricFile,
  type Attendance,
  type AttendanceIntelligenceSettings,
  type BiometricDevice,
  type EmployeeBiometricId,
  type EmployeeWorkSchedule,
  type PayrollLegalParameter,
  type PayrollPeriod,
  type PayrollPeriodStatus,
  type PublicHoliday,
  type WorkScheduleTemplate,
  type UnmatchedBiometricCode,
} from '../../services/human-resources.service';
import { getEmployees, type Employee } from '../../services/employees.service';
import { isAbortError } from '../../services/api';

type PayrollSection = 'periods' | 'schedules' | 'biometric' | 'holidays';

const PAYROLL_SECTIONS: Array<{ id: PayrollSection; label: string; icon: typeof Banknote }> = [
  { id: 'periods', label: 'Períodos de nómina', icon: Banknote },
  { id: 'schedules', label: 'Horarios', icon: Clock3 },
  { id: 'biometric', label: 'Biométrico', icon: Fingerprint },
  { id: 'holidays', label: 'Festivos y parámetros', icon: CalendarDays },
];

const PERIOD_STATUS_LABELS: Record<PayrollPeriodStatus, string> = {
  OPEN: 'Abierto',
  CALCULATED: 'Calculado',
  APPROVED: 'Aprobado',
  PAID: 'Pagado',
  CLOSED: 'Cerrado',
};

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function periodStatusColor(status: PayrollPeriodStatus): BadgeColor {
  if (status === 'PAID' || status === 'CLOSED') return 'green';
  if (status === 'APPROVED') return 'blue';
  if (status === 'CALCULATED') return 'yellow';
  return 'gray';
}

function formatMoney(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  return num.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CO');
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CO');
}

function useEmployeeDirectory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getEmployees({ limit: 500 });
        setEmployees(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  return { employees, employeeById, loading };
}

function employeeName(employee: Employee | undefined): string {
  if (!employee) return 'Empleado desconocido';
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

function describeApiError(error: unknown, fallback: string): string {
  if (isAbortError(error)) {
    return 'La operación está tardando más de lo esperado. Espera un momento y vuelve a intentarlo; si el archivo es muy grande, prueba dividirlo.';
  }
  return error instanceof Error ? error.message : fallback;
}

type BiometricPreviewPunch = {
  time: string;
  action: 'check_in' | 'break_start' | 'break_end' | 'check_out' | null;
};

type BiometricPreviewRow = {
  key: string;
  code: string;
  date: string;
  markCount: number;
  checkIn: string;
  breakStart: string;
  breakEnd: string;
  checkOut: string;
  workedHours: number;
  dayHours: number;
  nightHours: number;
  status: 'Completo' | 'Incompleto' | 'Revisar';
  marks: string;
};

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function parseBiometricTimestamp(raw: string): { date: string; time: string } | null {
  const text = raw.trim();
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match;
    return {
      date: `${year}-${twoDigits(Number(month))}-${twoDigits(Number(day))}`,
      time: `${twoDigits(Number(hour))}:${twoDigits(Number(minute))}:${twoDigits(Number(second))}`,
    };
  }
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second = '00'] = match;
  return {
    date: `${year}-${twoDigits(Number(month))}-${twoDigits(Number(day))}`,
    time: `${twoDigits(Number(hour))}:${twoDigits(Number(minute))}:${twoDigits(Number(second))}`,
  };
}

function punchActionFromColumns(columns: string[]): BiometricPreviewPunch['action'] {
  const normalized = columns.join(' ').trim().toLowerCase();
  if (!normalized) return null;
  if (/\b(check[_ -]?in|entrada|ingreso)\b/.test(normalized)) return 'check_in';
  if (/\b(check[_ -]?out|salida)\b/.test(normalized)) return 'check_out';
  if (/\b(break[_ -]?start|inicio almuerzo|inicio descanso)\b/.test(normalized)) return 'break_start';
  if (/\b(break[_ -]?end|fin almuerzo|fin descanso)\b/.test(normalized)) return 'break_end';
  const nonEmptyNumeric = columns.map((item) => item.trim()).filter(Boolean);
  if (nonEmptyNumeric.length === 1) {
    if (nonEmptyNumeric[0] === '1') return 'check_in';
    if (nonEmptyNumeric[0] === '2') return 'check_out';
    if (nonEmptyNumeric[0] === '3') return 'break_start';
    if (nonEmptyNumeric[0] === '4') return 'break_end';
  }
  return null;
}

function parseBiometricLine(line: string): { code: string; date: string; time: string; action: BiometricPreviewPunch['action'] } | null {
  const stripped = line.trim();
  if (!stripped) return null;
  const tabColumns = stripped.split('\t').map((item) => item.trim());
  if (tabColumns.length >= 2) {
    let timestampRaw = tabColumns[1];
    let rest = tabColumns.slice(2);
    if (rest[0] && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(rest[0])) {
      timestampRaw = `${timestampRaw} ${rest[0]}`;
      rest = rest.slice(1);
    }
    const timestamp = parseBiometricTimestamp(timestampRaw);
    if (timestamp && tabColumns[0]) {
      return { code: tabColumns[0], ...timestamp, action: punchActionFromColumns(rest) };
    }
  }

  const match = stripped.match(/^(\S+)\s+(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)(?:\s+(.*))?$/);
  if (!match) return null;
  const [, code, datePart, timePart, rest = ''] = match;
  const timestamp = parseBiometricTimestamp(`${datePart} ${timePart}`);
  if (!timestamp) return null;
  return { code, ...timestamp, action: punchActionFromColumns(rest.split(/\s+/)) };
}

function firstActionTime(punches: BiometricPreviewPunch[], action: BiometricPreviewPunch['action']): string {
  return punches.find((punch) => punch.action === action)?.time ?? '-';
}

function lastActionTime(punches: BiometricPreviewPunch[], action: BiometricPreviewPunch['action']): string {
  return [...punches].reverse().find((punch) => punch.action === action)?.time ?? '-';
}

function timeToMinutes(value: string): number | null {
  if (!value || value === '-') return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizePreviewTime(value: string): string {
  if (!value) return '-';
  const [hours = '00', minutes = '00'] = value.split(':');
  return `${twoDigits(Number(hours))}:${twoDigits(Number(minutes))}:00`;
}

function dayMinutesInSegment(start: number, end: number): number {
  const normalizedEnd = end >= start ? end : end + 1440;
  let total = 0;
  const firstDay = Math.floor(start / 1440);
  const lastDay = Math.floor(Math.max(start, normalizedEnd - 1) / 1440);
  for (let day = firstDay; day <= lastDay; day += 1) {
    const dayStart = day * 1440 + 360;
    const dayEnd = day * 1440 + 1140;
    total += Math.max(0, Math.min(normalizedEnd, dayEnd) - Math.max(start, dayStart));
  }
  return total;
}

function calculatePreviewHours(row: Pick<BiometricPreviewRow, 'checkIn' | 'breakStart' | 'breakEnd' | 'checkOut'>) {
  const checkIn = timeToMinutes(row.checkIn);
  const checkOutRaw = timeToMinutes(row.checkOut);
  if (checkIn === null || checkOutRaw === null) {
    return { workedHours: 0, dayHours: 0, nightHours: 0 };
  }
  const checkOut = checkOutRaw >= checkIn ? checkOutRaw : checkOutRaw + 1440;
  const breakStartRaw = timeToMinutes(row.breakStart);
  const breakEndRaw = timeToMinutes(row.breakEnd);
  const segments: Array<[number, number]> = [];

  if (breakStartRaw !== null && breakEndRaw !== null) {
    const breakStart = breakStartRaw >= checkIn ? breakStartRaw : breakStartRaw + 1440;
    const breakEnd = breakEndRaw >= breakStartRaw ? breakEndRaw : breakEndRaw + 1440;
    if (checkIn < breakStart && breakStart < breakEnd && breakEnd < checkOut) {
      segments.push([checkIn, breakStart], [breakEnd, checkOut]);
    } else {
      segments.push([checkIn, checkOut]);
    }
  } else {
    segments.push([checkIn, checkOut]);
  }

  const workedMinutes = segments.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
  const dayMinutes = segments.reduce((sum, [start, end]) => sum + dayMinutesInSegment(start, end), 0);
  return {
    workedHours: Number((workedMinutes / 60).toFixed(2)),
    dayHours: Number((dayMinutes / 60).toFixed(2)),
    nightHours: Number(((workedMinutes - dayMinutes) / 60).toFixed(2)),
  };
}

function enrichPreviewRow(row: Omit<BiometricPreviewRow, 'workedHours' | 'dayHours' | 'nightHours'>): BiometricPreviewRow {
  return { ...row, ...calculatePreviewHours(row) };
}

function buildBiometricPreviewRows(groups: Map<string, { code: string; date: string; punches: BiometricPreviewPunch[] }>): BiometricPreviewRow[] {
  return [...groups.values()]
    .map((group) => {
      const punches = [...group.punches].sort((left, right) => left.time.localeCompare(right.time));
      const hasActions = punches.some((punch) => punch.action);
      let checkIn = '-';
      let checkOut = '-';
      let breakStart = '-';
      let breakEnd = '-';
      let status: BiometricPreviewRow['status'] = 'Revisar';

      if (hasActions) {
        checkIn = firstActionTime(punches, 'check_in');
        checkOut = lastActionTime(punches, 'check_out');
        breakStart = firstActionTime(punches, 'break_start');
        breakEnd = lastActionTime(punches, 'break_end');
        status = checkIn !== '-' && checkOut !== '-' ? 'Completo' : 'Incompleto';
      } else if (punches.length === 1) {
        checkIn = punches[0].time;
        status = 'Incompleto';
      } else if (punches.length === 2) {
        checkIn = punches[0].time;
        checkOut = punches[1].time;
        status = 'Completo';
      } else if (punches.length === 4) {
        checkIn = punches[0].time;
        breakStart = punches[1].time;
        breakEnd = punches[2].time;
        checkOut = punches[3].time;
        status = 'Completo';
      } else {
        checkIn = punches[0]?.time ?? '-';
        checkOut = punches[punches.length - 1]?.time ?? '-';
        status = 'Revisar';
      }

      return enrichPreviewRow({
        key: `${group.code}-${group.date}`,
        code: group.code,
        date: group.date,
        markCount: punches.length,
        checkIn,
        breakStart,
        breakEnd,
        checkOut,
        status,
        marks: punches.map((punch) => punch.time).join(', '),
      });
    })
    .sort((left, right) => left.code.localeCompare(right.code, 'es', { numeric: true }) || left.date.localeCompare(right.date));
}

export function AdminPayroll() {
  const [activeSection, setActiveSection] = useState<PayrollSection>('periods');
  const { employees, employeeById, loading: loadingEmployees } = useEmployeeDirectory();

  return (
    <div>
      <PageHeader title="Nómina" subtitle="Períodos quincenales, horarios, importación biométrica y parámetros legales." />
      <TabBar tabs={PAYROLL_SECTIONS} value={activeSection} onChange={setActiveSection} />
      {loadingEmployees ? (
        <LoadingState label="Cargando empleados..." />
      ) : (
        <>
          {activeSection === 'periods' && <PeriodsSection employeeById={employeeById} />}
          {activeSection === 'schedules' && <SchedulesSection employees={employees} employeeById={employeeById} />}
          {activeSection === 'biometric' && <BiometricSection employees={employees} employeeById={employeeById} />}
          {activeSection === 'holidays' && <HolidaysSection />}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Períodos de nómina ───────────────────────── */

function PeriodsSection({ employeeById }: { employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPayrollPeriods({ limit: 50 });
      setPeriods(res.data);
      setSelectedPeriod((current) => {
        if (!current) return current;
        return res.data.find((p) => p.id === current.id) ?? current;
      });
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los períodos de nómina');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCalculate = async (period: PayrollPeriod) => {
    setBusyAction(period.id);
    try {
      const result = await calculatePayrollPeriod(period.id);
      if (result.errors.length > 0) {
        toast.warning(`Calculado con ${result.errors.length} error(es). Revisa el detalle.`);
      } else {
        toast.success(`Nómina calculada para ${result.calculated} empleado(s)`);
      }
      await load();
      setSelectedPeriod(result.period);
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo calcular el período'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async (period: PayrollPeriod) => {
    setBusyAction(period.id);
    try {
      const updated = await approvePayrollPeriod(period.id);
      toast.success('Período aprobado');
      await load();
      setSelectedPeriod(updated);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo aprobar el período');
    } finally {
      setBusyAction(null);
    }
  };

  const handleMarkPaid = async (period: PayrollPeriod) => {
    setBusyAction(period.id);
    try {
      const updated = await markPayrollPeriodPaid(period.id);
      toast.success('Período marcado como pagado');
      await load();
      setSelectedPeriod(updated);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo marcar como pagado');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) return <LoadingState label="Cargando períodos..." />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setShowNewModal(true)} icon={<Plus size={14} />}>Nuevo período</PrimaryButton>
      </div>

      {periods.length === 0 ? (
        <EmptyState title="Sin períodos de nómina" description="Crea un período quincenal para empezar a calcular la nómina." />
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          <Card className="p-3 space-y-2 h-fit">
            {periods.map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selectedPeriod?.id === period.id ? 'border-[#2a4038] bg-[#2a4038]/5' : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-900">{period.label || `${formatDate(period.period_start)} — ${formatDate(period.period_end)}`}</p>
                  <Badge label={PERIOD_STATUS_LABELS[period.status]} color={periodStatusColor(period.status)} />
                </div>
                <p className="text-[11px] text-gray-400">{formatDate(period.period_start)} - {formatDate(period.period_end)}</p>
              </button>
            ))}
          </Card>

          {selectedPeriod ? (
            <PeriodDetail
              period={selectedPeriod}
              employeeById={employeeById}
              busy={busyAction === selectedPeriod.id}
              onCalculate={() => void handleCalculate(selectedPeriod)}
              onApprove={() => void handleApprove(selectedPeriod)}
              onMarkPaid={() => void handleMarkPaid(selectedPeriod)}
            />
          ) : (
            <Card className="p-8"><EmptyState title="Selecciona un período" description="Elige un período de la lista para ver su detalle." /></Card>
          )}
        </div>
      )}

      <NewPeriodModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={async () => {
          setShowNewModal(false);
          await load();
        }}
      />
    </div>
  );
}

function PeriodDetail({
  period,
  employeeById,
  busy,
  onCalculate,
  onApprove,
  onMarkPaid,
}: {
  period: PayrollPeriod;
  employeeById: Map<string, Employee>;
  busy: boolean;
  onCalculate: () => void;
  onApprove: () => void;
  onMarkPaid: () => void;
}) {
  const totalNet = period.payrolls.reduce((sum, p) => sum + Number(p.net_salary || 0), 0);
  const totalGross = period.payrolls.reduce((sum, p) => sum + Number(p.gross_earnings || 0) + Number(p.base_salary || 0), 0);
  const totalDeductions = period.payrolls.reduce((sum, p) => sum + Number(p.total_deductions || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiCard label="Empleados liquidados" value={String(period.payrolls.length)} icon={Banknote} color="text-blue-600 bg-blue-50" />
        <KpiCard label="Total devengado" value={formatMoney(totalGross)} icon={Calculator} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Total neto a pagar" value={formatMoney(totalNet)} icon={CheckCircle2} color="text-purple-600 bg-purple-50" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{period.label}</p>
            <p className="text-xs text-gray-400">{formatDate(period.period_start)} - {formatDate(period.period_end)} · Deducciones: {formatMoney(totalDeductions)}</p>
          </div>
          <div className="flex items-center gap-2">
            {(period.status === 'OPEN' || period.status === 'CALCULATED') && (
              <SecondaryButton onClick={onCalculate} disabled={busy} icon={<Calculator size={13} />}>
                {busy ? 'Calculando...' : period.status === 'OPEN' ? 'Calcular' : 'Recalcular'}
              </SecondaryButton>
            )}
            {period.status === 'CALCULATED' && (
              <PrimaryButton onClick={onApprove} disabled={busy} icon={<CheckCircle2 size={13} />}>
                {busy ? 'Aprobando...' : 'Aprobar período'}
              </PrimaryButton>
            )}
            {period.status === 'APPROVED' && (
              <PrimaryButton onClick={onMarkPaid} disabled={busy} icon={<Banknote size={13} />}>
                {busy ? 'Marcando...' : 'Marcar como pagado'}
              </PrimaryButton>
            )}
          </div>
        </div>

        {period.payrolls.length === 0 ? (
          <EmptyState title="Sin nóminas calculadas" description="Usa 'Calcular' para generar la liquidación de cada empleado activo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3">Empleado</th>
                  <th className="py-2 pr-3">Comprobante</th>
                  <th className="py-2 pr-3">Días</th>
                  <th className="py-2 pr-3">Horas extra</th>
                  <th className="py-2 pr-3">Devengado</th>
                  <th className="py-2 pr-3">Deducciones</th>
                  <th className="py-2 pr-3">Neto</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {period.payrolls.map((payroll) => (
                  <tr key={payroll.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3">{payroll.employee_name || employeeName(employeeById.get(payroll.employee))}</td>
                    <td className="py-2 pr-3 text-gray-400">{payroll.payslip_number || '-'}</td>
                    <td className="py-2 pr-3">{payroll.worked_days ?? '-'}</td>
                    <td className="py-2 pr-3">{payroll.overtime_hours}</td>
                    <td className="py-2 pr-3">{formatMoney(Number(payroll.base_salary) + Number(payroll.gross_earnings))}</td>
                    <td className="py-2 pr-3 text-amber-600">{formatMoney(payroll.total_deductions)}</td>
                    <td className="py-2 pr-3 font-semibold text-gray-900">{formatMoney(payroll.net_salary)}</td>
                    <td className="py-2 pr-3">
                      <Badge label={payroll.status} color={payroll.status === 'PAID' ? 'green' : payroll.status === 'APPROVED' ? 'blue' : 'yellow'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function NewPeriodModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const toast = useToast();
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!periodStart || !periodEnd) {
      toast.warning('Indica la fecha de inicio y fin del período.');
      return;
    }
    setSaving(true);
    try {
      await createPayrollPeriod({ period_start: periodStart, period_end: periodEnd, label });
      toast.success('Período creado');
      setPeriodStart('');
      setPeriodEnd('');
      setLabel('');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el período');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo período de nómina" open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Inicio</span>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Fin</span>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Etiqueta (opcional)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: 1ra quincena julio 2026" className={inputCls} />
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Creando...' : 'Crear período'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Horarios ───────────────────────── */

const TEMPLATE_ACCENTS = [
  { dot: 'bg-blue-500', ring: 'border-blue-100' },
  { dot: 'bg-orange-500', ring: 'border-orange-100' },
  { dot: 'bg-violet-500', ring: 'border-violet-100' },
  { dot: 'bg-emerald-500', ring: 'border-emerald-100' },
  { dot: 'bg-rose-500', ring: 'border-rose-100' },
  { dot: 'bg-amber-500', ring: 'border-amber-100' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function SchedulesSection({ employees, employeeById }: { employees: Employee[]; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [schedules, setSchedules] = useState<EmployeeWorkSchedule[]>([]);
  const [templates, setTemplates] = useState<WorkScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reassignEmployeeId, setReassignEmployeeId] = useState<string | undefined>(undefined);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkScheduleTemplate | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState<WorkScheduleTemplate | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedulesRes, templatesRes] = await Promise.allSettled([
        getEmployeeWorkSchedules(),
        getWorkScheduleTemplates(),
      ]);
      if (schedulesRes.status === 'fulfilled') setSchedules(schedulesRes.value);
      if (templatesRes.status === 'fulfilled') setTemplates(templatesRes.value);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los horarios');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateEmployeeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const schedule of schedules) {
      if (!schedule.source_template || !schedule.is_active) continue;
      counts.set(schedule.source_template, (counts.get(schedule.source_template) ?? 0) + 1);
    }
    return counts;
  }, [schedules]);

  const templateNameById = useMemo(() => new Map(templates.map((t) => [t.id, t.name])), [templates]);

  const filteredSchedules = useMemo(() => {
    const term = search.trim().toLowerCase();
    return schedules.filter((schedule) => {
      if (statusFilter === 'ACTIVE' && !schedule.is_active) return false;
      if (statusFilter === 'INACTIVE' && schedule.is_active) return false;
      if (!term) return true;
      const employee = employeeById.get(schedule.employee);
      const name = employee ? employeeName(employee).toLowerCase() : '';
      return name.includes(term);
    });
  }, [schedules, statusFilter, search, employeeById]);

  if (loading) return <LoadingState label="Cargando horarios..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-semibold text-gray-900">Plantillas de horario</p>
            <p className="text-[11px] text-gray-500">Crea y administra plantillas para asignarlas fácilmente.</p>
          </div>
          <PrimaryButton onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }} icon={<Plus size={14} />}>
            Nueva plantilla
          </PrimaryButton>
        </div>

        {templates.length === 0 ? (
          <div className="pt-3">
            <EmptyState title="Sin plantillas todavía" description="Crea una plantilla para asignar el mismo horario a varios empleados en un solo paso." />
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
              {templates.map((template, index) => {
                const accent = TEMPLATE_ACCENTS[index % TEMPLATE_ACCENTS.length];
                const employeeCount = templateEmployeeCounts.get(template.id) ?? 0;
                return (
                  <div key={template.id} className={`border ${accent.ring} rounded-2xl p-4 flex flex-col`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                        <p className="text-xs font-semibold text-gray-900">{template.name}</p>
                      </div>
                      <ActionsMenu
                        items={[
                          { label: 'Editar plantilla', icon: Pencil, onClick: () => { setEditingTemplate(template); setShowTemplateModal(true); } },
                          { label: 'Aplicar a empleados', icon: Users, onClick: () => setApplyingTemplate(template) },
                        ]}
                      />
                    </div>
                    {template.description && <p className="text-[11px] text-gray-400 -mt-2 mb-2">{template.description}</p>}
                    <div className="space-y-1 mb-3 flex-1">
                      {template.days.map((day) => (
                        <div key={day.id} className="flex items-center justify-between text-[11px] text-gray-600">
                          <span>{WEEKDAY_LABELS[day.weekday]}</span>
                          <span className="font-mono">{day.expected_start_time.slice(0, 5)} - {day.expected_end_time.slice(0, 5)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-2 border-t border-gray-50">
                      <Users size={12} />
                      Aplicada a {employeeCount} empleado{employeeCount === 1 ? '' : 's'}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1.5">
              <CalendarDays size={12} />
              Consejo: crea plantillas reutilizables para ahorrar tiempo en la asignación de horarios.
            </p>
          </>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Empleados y horarios asignados</p>
            <p className="text-[11px] text-gray-500">Cada empleado necesita un horario esperado para calcular horas ordinarias/extra correctamente.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-52">
              <SearchBarAdmin value={search} onChange={setSearch} placeholder="Buscar empleado..." />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={`${selectCls} w-auto`}>
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
            <SecondaryButton onClick={() => { setReassignEmployeeId(undefined); setShowModal(true); }} icon={<Plus size={13} />}>Asignar horario</SecondaryButton>
          </div>
        </div>

        {filteredSchedules.length === 0 ? (
          <EmptyState
            title={schedules.length === 0 ? 'Sin horarios asignados' : 'Sin resultados'}
            description={schedules.length === 0 ? 'Asigna un horario individual o aplica una plantilla a varios empleados.' : 'Ajusta la búsqueda o el filtro de estado.'}
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredSchedules.map((schedule) => {
              const employee = employeeById.get(schedule.employee);
              return (
                <div key={schedule.id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-[#2a4038]/10 text-[#2a4038] flex items-center justify-center text-[11px] font-bold shrink-0">
                        {initials(employeeName(employee))}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{employeeName(employee)}</p>
                        <p className="text-[10px] text-gray-400">Vigente {formatDate(schedule.start_date)}</p>
                      </div>
                    </div>
                    <ActionsMenu
                      items={[
                        { label: 'Reasignar horario', icon: Pencil, onClick: () => { setReassignEmployeeId(schedule.employee); setShowModal(true); } },
                      ]}
                    />
                  </div>

                  {schedule.source_template && templateNameById.has(schedule.source_template) && (
                    <div className="mb-2">
                      <Badge label={templateNameById.get(schedule.source_template) as string} color="blue" />
                    </div>
                  )}

                  <div className="grid grid-cols-7 gap-1 mb-3">
                    {WEEKDAY_LABELS.map((label, weekday) => {
                      const day = schedule.days.find((d) => d.weekday === weekday);
                      return (
                        <div key={weekday} className="text-center">
                          <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">{label.slice(0, 3)}</p>
                          {day ? (
                            <p className="text-[9px] font-mono text-gray-600 leading-tight">
                              {day.expected_start_time.slice(0, 5)}<br />{day.expected_end_time.slice(0, 5)}
                            </p>
                          ) : (
                            <p className="text-[9px] text-gray-300">-</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Badge label={schedule.is_active ? 'Activo' : 'Inactivo'} color={schedule.is_active ? 'green' : 'gray'} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <NewScheduleModal
        open={showModal}
        employees={employees}
        initialEmployeeId={reassignEmployeeId}
        onClose={() => setShowModal(false)}
        onCreated={async () => {
          setShowModal(false);
          await load();
        }}
      />
      <NewTemplateModal
        open={showTemplateModal}
        editing={editingTemplate}
        onClose={() => setShowTemplateModal(false)}
        onCreated={async () => {
          setShowTemplateModal(false);
          setEditingTemplate(null);
          await load();
        }}
      />
      {applyingTemplate && (
        <ApplyTemplateModal
          template={applyingTemplate}
          employees={employees}
          onClose={() => setApplyingTemplate(null)}
          onApplied={async () => {
            setApplyingTemplate(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

type ScheduleDayForm = { weekday: number; expectedStart: string; expectedEnd: string; enabled: boolean };

function defaultWeekdayForm(): ScheduleDayForm[] {
  return WEEKDAY_LABELS.map((_, weekday) => ({
    weekday,
    expectedStart: '08:00',
    expectedEnd: '17:00',
    enabled: weekday < 5,
  }));
}

function NewScheduleModal({
  open,
  employees,
  initialEmployeeId,
  onClose,
  onCreated,
}: {
  open: boolean;
  employees: Employee[];
  initialEmployeeId?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState<ScheduleDayForm[]>(defaultWeekdayForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmployeeId(initialEmployeeId ?? '');
      setStartDate('');
      setDays(defaultWeekdayForm());
    }
  }, [open, initialEmployeeId]);

  const updateDay = (weekday: number, patch: Partial<ScheduleDayForm>) => {
    setDays((current) => current.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  };

  const handleSubmit = async () => {
    if (!employeeId || !startDate) {
      toast.warning('Selecciona el empleado y la fecha de inicio.');
      return;
    }
    const activeDays = days.filter((d) => d.enabled);
    if (activeDays.length === 0) {
      toast.warning('Activa al menos un día de la semana.');
      return;
    }
    setSaving(true);
    try {
      await setEmployeeWorkSchedule({
        employee: employeeId,
        start_date: startDate,
        days: activeDays.map((d) => ({
          weekday: d.weekday,
          expected_start_time: d.expectedStart,
          expected_end_time: d.expectedEnd,
        })),
      });
      toast.success('Horario asignado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo asignar el horario'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Asignar horario de empleado" open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Empleado</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={selectCls}>
              <option value="">Selecciona...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employeeName(employee)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Vigente desde</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Franjas por día</p>
          {days.map((day) => (
            <div key={day.weekday} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2.5">
              <label className="flex items-center gap-2 w-28 text-xs text-gray-700">
                <input type="checkbox" checked={day.enabled} onChange={(e) => updateDay(day.weekday, { enabled: e.target.checked })} />
                {WEEKDAY_LABELS[day.weekday]}
              </label>
              <input
                type="time"
                value={day.expectedStart}
                disabled={!day.enabled}
                onChange={(e) => updateDay(day.weekday, { expectedStart: e.target.value })}
                className={`${inputCls} disabled:opacity-40`}
              />
              <span className="text-xs text-gray-400">a</span>
              <input
                type="time"
                value={day.expectedEnd}
                disabled={!day.enabled}
                onChange={(e) => updateDay(day.weekday, { expectedEnd: e.target.value })}
                className={`${inputCls} disabled:opacity-40`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Asignar horario'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NewTemplateModal({
  open,
  editing,
  onClose,
  onCreated,
}: {
  open: boolean;
  editing?: WorkScheduleTemplate | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState<ScheduleDayForm[]>(defaultWeekdayForm());
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(editing);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setDays(
        WEEKDAY_LABELS.map((_, weekday) => {
          const match = editing.days.find((d) => d.weekday === weekday);
          return {
            weekday,
            expectedStart: match ? match.expected_start_time.slice(0, 5) : '08:00',
            expectedEnd: match ? match.expected_end_time.slice(0, 5) : '17:00',
            enabled: Boolean(match),
          };
        }),
      );
    } else {
      setName('');
      setDescription('');
      setDays(defaultWeekdayForm());
    }
  }, [open, editing]);

  const updateDay = (weekday: number, patch: Partial<ScheduleDayForm>) => {
    setDays((current) => current.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.warning('Indica un nombre para la plantilla.');
      return;
    }
    const activeDays = days.filter((d) => d.enabled);
    if (activeDays.length === 0) {
      toast.warning('Activa al menos un día de la semana.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        days: activeDays.map((d) => ({
          weekday: d.weekday,
          expected_start_time: d.expectedStart,
          expected_end_time: d.expectedEnd,
        })),
      };
      if (editing) {
        await updateWorkScheduleTemplate(editing.id, payload);
        toast.success('Plantilla actualizada');
      } else {
        await createWorkScheduleTemplate(payload);
        toast.success('Plantilla creada');
      }
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo guardar la plantilla'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEditing ? 'Editar plantilla de horario' : 'Nueva plantilla de horario'} open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Turno mañana 7:00-16:30" className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Descripción (opcional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Franjas por día</p>
          {days.map((day) => (
            <div key={day.weekday} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2.5">
              <label className="flex items-center gap-2 w-28 text-xs text-gray-700">
                <input type="checkbox" checked={day.enabled} onChange={(e) => updateDay(day.weekday, { enabled: e.target.checked })} />
                {WEEKDAY_LABELS[day.weekday]}
              </label>
              <input
                type="time"
                value={day.expectedStart}
                disabled={!day.enabled}
                onChange={(e) => updateDay(day.weekday, { expectedStart: e.target.value })}
                className={`${inputCls} disabled:opacity-40`}
              />
              <span className="text-xs text-gray-400">a</span>
              <input
                type="time"
                value={day.expectedEnd}
                disabled={!day.enabled}
                onChange={(e) => updateDay(day.weekday, { expectedEnd: e.target.value })}
                className={`${inputCls} disabled:opacity-40`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plantilla'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function ApplyTemplateModal({
  template,
  employees,
  onClose,
  onApplied,
}: {
  template: WorkScheduleTemplate;
  employees: Employee[];
  onClose: () => void;
  onApplied: () => Promise<void>;
}) {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleEmployee = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast.warning('Selecciona al menos un empleado.');
      return;
    }
    if (!startDate) {
      toast.warning('Indica la fecha de inicio.');
      return;
    }
    setSaving(true);
    try {
      const result = await applyWorkScheduleTemplate(template.id, {
        employee_ids: Array.from(selectedIds),
        start_date: startDate,
      });
      if (result.errors.length > 0) {
        toast.warning(`Aplicado a ${result.applied} empleado(s), con ${result.errors.length} error(es).`);
      } else {
        toast.success(`Horario aplicado a ${result.applied} empleado(s).`);
      }
      await onApplied();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo aplicar la plantilla'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Aplicar "${template.name}" a empleados`} open onClose={onClose} wide>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Vigente desde</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </label>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Empleados ({selectedIds.size} seleccionados)</span>
            <button
              type="button"
              onClick={() => setSelectedIds(selectedIds.size === employees.length ? new Set() : new Set(employees.map((e) => e.id)))}
              className="text-[11px] text-[#2a4038] font-semibold hover:underline"
            >
              {selectedIds.size === employees.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {employees.map((employee) => (
              <label key={employee.id} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selectedIds.has(employee.id)} onChange={() => toggleEmployee(employee.id)} />
                {employeeName(employee)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Aplicando...' : 'Aplicar a empleados'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Biométrico ───────────────────────── */

function BiometricSection({ employees, employeeById }: { employees: Employee[]; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [mappings, setMappings] = useState<EmployeeBiometricId[]>([]);
  const [pending, setPending] = useState<Attendance[]>([]);
  const [unmatchedCodes, setUnmatchedCodes] = useState<UnmatchedBiometricCode[]>([]);
  const [intelligenceSettings, setIntelligenceSettings] = useState<AttendanceIntelligenceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingInitialCode, setMappingInitialCode] = useState<string | undefined>(undefined);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState<Attendance | null>(null);
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
  const [uploadingDevice, setUploadingDevice] = useState('');
  const [uploadDateFrom, setUploadDateFrom] = useState('');
  const [uploadDateTo, setUploadDateTo] = useState('');
  const [previewRows, setPreviewRows] = useState<BiometricPreviewRow[]>([]);
  const [previewProgress, setPreviewProgress] = useState({ processed: 0, total: 0, parsed: 0 });
  const [previewParsing, setPreviewParsing] = useState(false);
  const [previewFileName, setPreviewFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [expandedPreviewCodes, setExpandedPreviewCodes] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, mappingsRes, pendingRes, unmatchedRes, intelligenceRes] = await Promise.allSettled([
        getBiometricDevices(),
        getEmployeeBiometricIds(),
        getPendingCorrectionAttendance(),
        getUnmatchedBiometricCodes(),
        getAttendanceIntelligenceSettings(),
      ]);
      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value);
      if (mappingsRes.status === 'fulfilled') setMappings(mappingsRes.value);
      if (pendingRes.status === 'fulfilled') setPending(pendingRes.value);
      if (unmatchedRes.status === 'fulfilled') setUnmatchedCodes(unmatchedRes.value);
      if (intelligenceRes.status === 'fulfilled') setIntelligenceSettings(intelligenceRes.value);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la información biométrica');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (file: File) => {
    if (uploadDateFrom && uploadDateTo && uploadDateTo < uploadDateFrom) {
      toast.error('La fecha hasta no puede ser anterior a la fecha desde.');
      return;
    }
    setPreviewRows([]);
    setPreviewFileName(file.name);
    setPreviewProgress({ processed: 0, total: 0, parsed: 0 });
    setPreviewParsing(true);
    const groups = new Map<string, { code: string; date: string; punches: BiometricPreviewPunch[] }>();
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      let parsed = 0;
      for (let index = 0; index < lines.length; index += 1) {
        const parsedLine = parseBiometricLine(lines[index]);
        if (parsedLine) {
          const inRange =
            (!uploadDateFrom || parsedLine.date >= uploadDateFrom) &&
            (!uploadDateTo || parsedLine.date <= uploadDateTo);
          if (inRange) {
            const key = `${parsedLine.code}-${parsedLine.date}`;
            const group = groups.get(key) ?? { code: parsedLine.code, date: parsedLine.date, punches: [] };
            group.punches.push({ time: parsedLine.time, action: parsedLine.action });
            groups.set(key, group);
            parsed += 1;
          }
        }
        if ((index + 1) % 500 === 0 || index === lines.length - 1) {
          setPreviewRows(buildBiometricPreviewRows(groups));
          setPreviewProgress({ processed: index + 1, total: lines.length, parsed });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (parsed === 0) {
        toast.error('No se encontraron marcaciones del TXT para el rango seleccionado.');
        return;
      }
    } catch (error) {
      console.error(error);
      toast.error('No se pudo analizar el TXT del huellero.');
      return;
    } finally {
      setPreviewParsing(false);
    }
    setUploading(true);
    try {
      const batch = await uploadBiometricFile(file, uploadingDevice || undefined, {
        dateFrom: uploadDateFrom || undefined,
        dateTo: uploadDateTo || undefined,
      });
      toast.success(`TXT procesado: ${batch.total_rows} marcaciones por codigo, ${batch.duplicate_rows} duplicadas.`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo importar el archivo'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await deleteEmployeeBiometricId(id);
      toast.success('Mapeo eliminado');
      await load();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el mapeo');
    }
  };

  const previewByCode = useMemo(() => {
    const groups = new Map<
      string,
      {
        code: string;
        rows: BiometricPreviewRow[];
        markCount: number;
        totalHours: number;
        dayHours: number;
        nightHours: number;
        reviewDays: number;
      }
    >();

    for (const row of previewRows) {
      const group = groups.get(row.code) ?? {
        code: row.code,
        rows: [],
        markCount: 0,
        totalHours: 0,
        dayHours: 0,
        nightHours: 0,
        reviewDays: 0,
      };
      group.rows.push(row);
      group.markCount += row.markCount;
      group.totalHours += row.workedHours;
      group.dayHours += row.dayHours;
      group.nightHours += row.nightHours;
      if (row.status !== 'Completo') group.reviewDays += 1;
      groups.set(row.code, group);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        rows: group.rows.sort((left, right) => left.date.localeCompare(right.date)),
        totalHours: Number(group.totalHours.toFixed(2)),
        dayHours: Number(group.dayHours.toFixed(2)),
        nightHours: Number(group.nightHours.toFixed(2)),
      }))
      .sort((left, right) => left.code.localeCompare(right.code, 'es', { numeric: true }));
  }, [previewRows]);

  const togglePreviewCode = (code: string) => {
    setExpandedPreviewCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const updatePreviewTime = (
    rowKey: string,
    field: 'checkIn' | 'breakStart' | 'breakEnd' | 'checkOut',
    value: string,
  ) => {
    setPreviewRows((rows) =>
      rows.map((row) => {
        if (row.key !== rowKey) return row;
        const next = enrichPreviewRow({ ...row, [field]: normalizePreviewTime(value) });
        next.status = next.checkIn !== '-' && next.checkOut !== '-' ? 'Completo' : 'Incompleto';
        return next;
      }),
    );
  };

  if (loading) return <LoadingState label="Cargando información biométrica..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Inteligencia de marcaciones</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              El TXT del huellero se guarda primero por codigo, sin relacionarlo automaticamente con empleados. Marcaciones separadas por menos de <strong>{intelligenceSettings?.duplicate_punch_window_minutes ?? 15} min</strong> se tratan como repetidas.
            </p>
          </div>
          <SecondaryButton onClick={() => setShowIntelligenceModal(true)}>Ajustar</SecondaryButton>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Importar TXT del reloj biometrico</p>
          <SecondaryButton onClick={() => setShowDeviceModal(true)} icon={<Plus size={13} />}>Nuevo dispositivo</SecondaryButton>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,180px)_minmax(150px,180px)_auto] items-end gap-3">
          <label className="block flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dispositivo (opcional)</span>
            <select value={uploadingDevice} onChange={(e) => setUploadingDevice(e.target.value)} className={selectCls}>
              <option value="">Sin especificar</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tomar desde</span>
            <input type="date" value={uploadDateFrom} onChange={(e) => setUploadDateFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tomar hasta</span>
            <input type="date" value={uploadDateTo} onChange={(e) => setUploadDateTo(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors cursor-pointer disabled:opacity-50">
            <UploadCloud size={14} />
            {uploading ? 'Subiendo...' : 'Subir archivo'}
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </Card>

      {(previewFileName || previewRows.length > 0) && (
        <Card className="p-5">
          <div className="flex flex-col gap-3 mb-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Tabla analizada del TXT</p>
              <p className="text-[11px] text-gray-500">
                {previewFileName || 'Archivo seleccionado'} - {previewProgress.parsed} marcaciones tomadas - {previewByCode.length} codigos - {previewRows.length} dias
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={`${previewRows.reduce((sum, row) => sum + row.workedHours, 0).toFixed(2)} hrs trabajadas`} color="gray" />
              <Badge label={`${previewRows.reduce((sum, row) => sum + row.dayHours, 0).toFixed(2)} diurnas`} color="green" />
              <Badge label={`${previewRows.reduce((sum, row) => sum + row.nightHours, 0).toFixed(2)} nocturnas`} color="blue" />
              {previewParsing && <Badge label={`Leyendo ${previewProgress.processed}/${previewProgress.total}`} color="yellow" />}
            </div>
          </div>
          {previewProgress.total > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[#2a4038] transition-all"
                style={{ width: `${Math.min(100, Math.round((previewProgress.processed / previewProgress.total) * 100))}%` }}
              />
            </div>
          )}
          {previewRows.length === 0 ? (
            <EmptyState title={previewParsing ? 'Analizando TXT...' : 'Sin marcaciones para mostrar'} />
          ) : (
            <div className="overflow-auto max-h-[520px] border border-gray-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                    <th className="py-2 px-3">Codigo</th>
                    <th className="py-2 px-3">Dias</th>
                    <th className="py-2 px-3">Marcas</th>
                    <th className="py-2 px-3">Hrs</th>
                    <th className="py-2 px-3">Diurnas</th>
                    <th className="py-2 px-3">Nocturnas</th>
                    <th className="py-2 px-3">Revision</th>
                    <th className="py-2 px-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {previewByCode.map((group) => {
                    const expanded = expandedPreviewCodes.has(group.code);
                    return (
                      <Fragment key={group.code}>
                        <tr key={group.code} className="border-b border-gray-50 bg-white">
                          <td className="py-3 px-3 font-mono text-sm font-semibold text-gray-900">{group.code}</td>
                          <td className="py-3 px-3">{group.rows.length}</td>
                          <td className="py-3 px-3">{group.markCount}</td>
                          <td className="py-3 px-3 font-semibold">{group.totalHours.toFixed(2)}</td>
                          <td className="py-3 px-3 text-emerald-700">{group.dayHours.toFixed(2)}</td>
                          <td className="py-3 px-3 text-indigo-700">{group.nightHours.toFixed(2)}</td>
                          <td className="py-3 px-3">
                            <Badge
                              label={group.reviewDays > 0 ? `${group.reviewDays} dia(s)` : 'OK'}
                              color={group.reviewDays > 0 ? 'yellow' : 'green'}
                            />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => togglePreviewCode(group.code)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-[#2a4038] hover:bg-gray-50"
                            >
                              {expanded ? 'Ocultar' : 'Ver mas'}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${group.code}-detail`} className="border-b border-gray-100 bg-gray-50/60">
                            <td colSpan={8} className="px-3 py-3">
                              <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                                      <th className="py-2 px-3">Dia</th>
                                      <th className="py-2 px-3">Marcas</th>
                                      <th className="py-2 px-3">Entrada</th>
                                      <th className="py-2 px-3">Inicio almuerzo</th>
                                      <th className="py-2 px-3">Fin almuerzo</th>
                                      <th className="py-2 px-3">Salida</th>
                                      <th className="py-2 px-3">Hrs</th>
                                      <th className="py-2 px-3">Diurnas</th>
                                      <th className="py-2 px-3">Nocturnas</th>
                                      <th className="py-2 px-3">Estado</th>
                                      <th className="py-2 px-3 min-w-[180px]">Todas</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.rows.map((row) => (
                                      <tr key={row.key} className="border-b border-gray-50 last:border-0">
                                        <td className="py-2 px-3 whitespace-nowrap">{formatDate(row.date)}</td>
                                        <td className="py-2 px-3">{row.markCount}</td>
                                        {(['checkIn', 'breakStart', 'breakEnd', 'checkOut'] as const).map((field) => (
                                          <td key={field} className="py-2 px-3">
                                            <input
                                              type="time"
                                              value={row[field] === '-' ? '' : row[field].slice(0, 5)}
                                              onChange={(event) => updatePreviewTime(row.key, field, event.target.value)}
                                              className="w-[96px] rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20"
                                            />
                                          </td>
                                        ))}
                                        <td className="py-2 px-3 font-semibold">{row.workedHours.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-emerald-700">{row.dayHours.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-indigo-700">{row.nightHours.toFixed(2)}</td>
                                        <td className="py-2 px-3">
                                          <Badge label={row.status} color={row.status === 'Completo' ? 'green' : row.status === 'Incompleto' ? 'yellow' : 'gray'} />
                                        </td>
                                        <td className="py-2 px-3 text-gray-500">{row.marks}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {unmatchedCodes.length > 0 && (
        <Card className="p-5 border-amber-200 bg-amber-50/40">
          <div className="mb-3">
            <p className="text-sm font-semibold text-gray-900">Códigos sin mapear</p>
            <p className="text-[11px] text-gray-500">Estos códigos llegaron en archivos importados pero no están asociados a ningún empleado. Asígnalos para que sus marcaciones cuenten en la asistencia.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-amber-200">
                  <th className="py-2 pr-3">Código del reloj</th>
                  <th className="py-2 pr-3">Veces visto</th>
                  <th className="py-2 pr-3">Última marcación</th>
                  <th className="py-2 pr-3">Dispositivo</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {unmatchedCodes.map((entry) => (
                  <tr key={entry.biometric_code} className="border-b border-amber-100">
                    <td className="py-2 pr-3 font-mono font-semibold">{entry.biometric_code}</td>
                    <td className="py-2 pr-3">{entry.occurrences}</td>
                    <td className="py-2 pr-3 text-gray-500">{formatDateTime(entry.last_seen)}</td>
                    <td className="py-2 pr-3 text-gray-500">{entry.device_name || 'Sin especificar'}</td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        onClick={() => {
                          setMappingInitialCode(entry.biometric_code);
                          setShowMappingModal(true);
                        }}
                        className="text-[#2a4038] font-semibold hover:underline"
                      >
                        Asignar empleado
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Mapeo de códigos del reloj a empleados</p>
          <SecondaryButton onClick={() => { setMappingInitialCode(undefined); setShowMappingModal(true); }} icon={<Plus size={13} />}>Nuevo mapeo</SecondaryButton>
        </div>
        {mappings.length === 0 ? (
          <EmptyState title="Sin mapeos registrados" description="Sin mapeo, las marcaciones del reloj no se pueden asociar a un empleado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3">Código del reloj</th>
                  <th className="py-2 pr-3">Empleado</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-mono">{mapping.biometric_code}</td>
                    <td className="py-2 pr-3">{employeeName(employeeById.get(mapping.employee))}</td>
                    <td className="py-2 pr-3">
                      <Badge label={mapping.is_active ? 'Activo' : 'Inactivo'} color={mapping.is_active ? 'green' : 'gray'} />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button onClick={() => void handleDeleteMapping(mapping.id)} className="text-red-500 hover:underline">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Marcaciones pendientes de corrección</p>
        {pending.length === 0 ? (
          <EmptyState title="Sin marcaciones pendientes" description="Todas las asistencias tienen entrada y salida completas." />
        ) : (
          <div className="space-y-2">
            {pending.map((attendance) => (
              <div key={attendance.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{employeeName(employeeById.get(attendance.employee))}</p>
                  <p className="text-[11px] text-gray-400">
                    {formatDate(attendance.date)} · Entrada: {attendance.check_in ? formatDateTime(attendance.check_in) : 'Sin registrar'} · Salida: {attendance.check_out ? formatDateTime(attendance.check_out) : 'Sin registrar'}
                  </p>
                </div>
                <SecondaryButton onClick={() => setShowCorrectionModal(attendance)}>Corregir</SecondaryButton>
              </div>
            ))}
          </div>
        )}
      </Card>

      <NewBiometricMappingModal
        open={showMappingModal}
        employees={employees}
        devices={devices}
        initialCode={mappingInitialCode}
        onClose={() => setShowMappingModal(false)}
        onCreated={async () => {
          setShowMappingModal(false);
          await load();
        }}
      />
      <NewBiometricDeviceModal
        open={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        onCreated={async () => {
          setShowDeviceModal(false);
          await load();
        }}
      />
      {showCorrectionModal && (
        <CorrectAttendanceModal
          attendance={showCorrectionModal}
          employeeName={employeeName(employeeById.get(showCorrectionModal.employee))}
          onClose={() => setShowCorrectionModal(null)}
          onCorrected={async () => {
            setShowCorrectionModal(null);
            await load();
          }}
        />
      )}
      <AttendanceIntelligenceModal
        open={showIntelligenceModal}
        settings={intelligenceSettings}
        onClose={() => setShowIntelligenceModal(false)}
        onSaved={async () => {
          setShowIntelligenceModal(false);
          await load();
        }}
      />
    </div>
  );
}

function AttendanceIntelligenceModal({
  open,
  settings,
  onClose,
  onSaved,
}: {
  open: boolean;
  settings: AttendanceIntelligenceSettings | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [duplicateWindow, setDuplicateWindow] = useState('15');
  const [proximityWindow, setProximityWindow] = useState('120');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDuplicateWindow(String(settings?.duplicate_punch_window_minutes ?? 15));
    setProximityWindow(String(settings?.schedule_proximity_minutes ?? 120));
  }, [open, settings]);

  const handleSubmit = async () => {
    const duplicateMinutes = Number(duplicateWindow);
    const proximityMinutes = Number(proximityWindow);
    if (!duplicateMinutes || duplicateMinutes <= 0 || !proximityMinutes || proximityMinutes <= 0) {
      toast.warning('Ambos valores deben ser números mayores a cero.');
      return;
    }
    setSaving(true);
    try {
      await updateAttendanceIntelligenceSettings({
        duplicate_punch_window_minutes: duplicateMinutes,
        schedule_proximity_minutes: proximityMinutes,
      });
      toast.success('Configuración guardada');
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo guardar la configuración'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Inteligencia de marcaciones" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ventana de duplicado (minutos)</span>
          <input type="number" min={1} value={duplicateWindow} onChange={(e) => setDuplicateWindow(e.target.value)} className={inputCls} />
          <p className="text-[11px] text-gray-400 mt-1">Si un empleado marca dos veces con menos de esta diferencia, se asume que la segunda fue por error (creyó que no había marcado) y se descarta.</p>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tolerancia al horario esperado (minutos)</span>
          <input type="number" min={1} value={proximityWindow} onChange={(e) => setProximityWindow(e.target.value)} className={inputCls} />
          <p className="text-[11px] text-gray-400 mt-1">Al interpretar un día con marcaciones incompletas, se usa esta cercanía a la hora de entrada/salida esperada del empleado para decidir qué marcación es cuál.</p>
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NewBiometricMappingModal({
  open,
  employees,
  devices,
  initialCode,
  onClose,
  onCreated,
}: {
  open: boolean;
  employees: Employee[];
  devices: BiometricDevice[];
  initialCode?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [biometricCode, setBiometricCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmployeeId('');
      setDeviceId('');
      setBiometricCode(initialCode ?? '');
    }
  }, [open, initialCode]);

  const handleSubmit = async () => {
    if (!employeeId || !biometricCode.trim()) {
      toast.warning('Selecciona el empleado e indica el código del reloj.');
      return;
    }
    setSaving(true);
    try {
      await createEmployeeBiometricId({ employee: employeeId, biometric_code: biometricCode.trim(), device: deviceId || null });
      toast.success('Mapeo registrado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el mapeo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo mapeo de código biométrico" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Empleado</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={selectCls}>
            <option value="">Selecciona...</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employeeName(employee)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Código en el reloj biométrico</span>
          <input value={biometricCode} onChange={(e) => setBiometricCode(e.target.value)} placeholder="Ej: 610" className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dispositivo (opcional)</span>
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={selectCls}>
            <option value="">Sin especificar</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>{device.name}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar mapeo'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NewBiometricDeviceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setLocation('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.warning('Indica el nombre del dispositivo.');
      return;
    }
    setSaving(true);
    try {
      await createBiometricDevice({ name: name.trim(), location: location.trim() });
      toast.success('Dispositivo registrado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el dispositivo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo reloj biométrico" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Reloj sede principal" className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ubicación (opcional)</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar dispositivo'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function toTimeInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  if (!timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

function CorrectAttendanceModal({
  attendance,
  employeeName: name,
  onClose,
  onCorrected,
}: {
  attendance: Attendance;
  employeeName: string;
  onClose: () => void;
  onCorrected: () => Promise<void>;
}) {
  const toast = useToast();
  const [checkIn, setCheckIn] = useState(toTimeInputValue(attendance.check_in));
  const [checkOut, setCheckOut] = useState(toTimeInputValue(attendance.check_out));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.warning('Indica el motivo de la corrección.');
      return;
    }
    setSaving(true);
    try {
      await correctAttendance(attendance.id, {
        check_in: combineDateAndTime(attendance.date, checkIn),
        check_out: combineDateAndTime(attendance.date, checkOut),
        reason: reason.trim(),
      });
      toast.success('Asistencia corregida');
      await onCorrected();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo corregir la asistencia');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Corregir asistencia" open onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-gray-500">{name} · {formatDate(attendance.date)}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Entrada</span>
            <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Salida</span>
            <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Motivo de la corrección</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Ej: Olvidó marcar la salida, confirmado con el jefe de área." />
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar corrección'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Festivos y parámetros legales ───────────────────────── */

function HolidaysSection() {
  const toast = useToast();
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [parameters, setParameters] = useState<PayrollLegalParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [showParamModal, setShowParamModal] = useState(false);

  const load = useCallback(async (targetYear: number) => {
    setLoading(true);
    try {
      const [holidaysList, parametersList] = await Promise.all([
        getPublicHolidays({ year: targetYear }),
        getPayrollLegalParameters(),
      ]);
      setHolidays(holidaysList);
      setParameters(parametersList);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la información de festivos y parámetros');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(year);
  }, [load, year]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const created = await generateYearHolidays(year);
      toast.success(created.length > 0 ? `${created.length} festivo(s) generado(s)` : 'El catálogo de ese año ya estaba completo');
      await load(year);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el calendario de festivos');
    } finally {
      setGenerating(false);
    }
  };

  const currentParameter = parameters.find((p) => p.year === year);

  if (loading) return <LoadingState label="Cargando festivos y parámetros..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Año</span>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls} />
          </label>
          <SecondaryButton onClick={() => void handleGenerate()} disabled={generating} icon={<CalendarDays size={13} />}>
            {generating ? 'Generando...' : 'Generar festivos del año'}
          </SecondaryButton>
        </div>

        {holidays.length === 0 ? (
          <EmptyState title={`Sin festivos registrados para ${year}`} description="Usa 'Generar festivos del año' para pre-poblar el calendario colombiano." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((holiday) => (
                  <tr key={holiday.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3">{formatDate(holiday.civil_date)}</td>
                    <td className="py-2 pr-3">{holiday.name}</td>
                    <td className="py-2 pr-3 text-gray-400">
                      {holiday.kind === 'FIXED' ? 'Fecha fija' : holiday.kind === 'EASTER_BASED' ? 'Semana Santa' : 'Trasladado a lunes'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Parámetros legales {year}</p>
          <SecondaryButton onClick={() => setShowParamModal(true)} icon={<Plus size={13} />}>
            {currentParameter ? 'Editar' : 'Registrar'}
          </SecondaryButton>
        </div>
        {!currentParameter ? (
          <EmptyState title={`Sin parámetros legales para ${year}`} description="SMMLV, auxilio de transporte y porcentajes de salud/pensión no están configurados." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ParamField label="SMMLV" value={formatMoney(currentParameter.minimum_wage)} />
            <ParamField label="Auxilio de transporte" value={formatMoney(currentParameter.transport_allowance_amount)} />
            <ParamField label="Tope aux. transporte" value={`${currentParameter.transport_allowance_salary_cap_factor} SMMLV`} />
            <ParamField label="Salud (empleado)" value={`${currentParameter.health_employee_pct}%`} />
            <ParamField label="Pensión (empleado)" value={`${currentParameter.pension_employee_pct}%`} />
            <ParamField label="Divisor de horas mensual" value={currentParameter.monthly_hours_divisor_default} />
            <ParamField label="Recargo ordinaria nocturna" value={currentParameter.night_ordinary_surcharge_pct ? `${currentParameter.night_ordinary_surcharge_pct}%` : '35% (default)'} />
            <ParamField label="Recargo extra diurna" value={currentParameter.day_extra_surcharge_pct ? `${currentParameter.day_extra_surcharge_pct}%` : '25% (default)'} />
            <ParamField label="Recargo extra nocturna" value={currentParameter.night_extra_surcharge_pct ? `${currentParameter.night_extra_surcharge_pct}%` : '75% (default)'} />
            <ParamField label="Recargo dominical/festivo" value={currentParameter.sunday_holiday_surcharge_pct ? `${currentParameter.sunday_holiday_surcharge_pct}%` : 'Escalonado por fecha (default)'} />
          </div>
        )}
      </Card>

      <LegalParameterModal
        open={showParamModal}
        year={year}
        existing={currentParameter}
        onClose={() => setShowParamModal(false)}
        onSaved={async () => {
          setShowParamModal(false);
          await load(year);
        }}
      />
    </div>
  );
}

function ParamField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

function LegalParameterModal({
  open,
  year,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  year: number;
  existing: PayrollLegalParameter | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [minimumWage, setMinimumWage] = useState('');
  const [transportAllowance, setTransportAllowance] = useState('');
  const [capFactor, setCapFactor] = useState('2');
  const [healthPct, setHealthPct] = useState('4');
  const [pensionPct, setPensionPct] = useState('4');
  const [monthlyDivisor, setMonthlyDivisor] = useState('230');
  const [nightOrdinaryPct, setNightOrdinaryPct] = useState('');
  const [dayExtraPct, setDayExtraPct] = useState('');
  const [nightExtraPct, setNightExtraPct] = useState('');
  const [sundayHolidayPct, setSundayHolidayPct] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMinimumWage(existing?.minimum_wage ?? '');
    setTransportAllowance(existing?.transport_allowance_amount ?? '');
    setCapFactor(existing?.transport_allowance_salary_cap_factor ?? '2');
    setHealthPct(existing?.health_employee_pct ?? '4');
    setPensionPct(existing?.pension_employee_pct ?? '4');
    setMonthlyDivisor(existing?.monthly_hours_divisor_default ?? '230');
    setNightOrdinaryPct(existing?.night_ordinary_surcharge_pct ?? '');
    setDayExtraPct(existing?.day_extra_surcharge_pct ?? '');
    setNightExtraPct(existing?.night_extra_surcharge_pct ?? '');
    setSundayHolidayPct(existing?.sunday_holiday_surcharge_pct ?? '');
  }, [open, existing]);

  const handleSubmit = async () => {
    if (!minimumWage) {
      toast.warning('Indica el valor del SMMLV.');
      return;
    }
    setSaving(true);
    try {
      const surchargeFields = {
        night_ordinary_surcharge_pct: nightOrdinaryPct === '' ? null : nightOrdinaryPct,
        day_extra_surcharge_pct: dayExtraPct === '' ? null : dayExtraPct,
        night_extra_surcharge_pct: nightExtraPct === '' ? null : nightExtraPct,
        sunday_holiday_surcharge_pct: sundayHolidayPct === '' ? null : sundayHolidayPct,
      };
      if (existing) {
        await updatePayrollLegalParameter(existing.id, {
          minimum_wage: minimumWage,
          transport_allowance_amount: transportAllowance || 0,
          transport_allowance_salary_cap_factor: capFactor,
          health_employee_pct: healthPct,
          pension_employee_pct: pensionPct,
          monthly_hours_divisor_default: monthlyDivisor,
          ...surchargeFields,
        });
      } else {
        await createPayrollLegalParameter({
          year,
          minimum_wage: minimumWage,
          transport_allowance_amount: transportAllowance || 0,
          transport_allowance_salary_cap_factor: capFactor,
          health_employee_pct: healthPct,
          pension_employee_pct: pensionPct,
          monthly_hours_divisor_default: monthlyDivisor,
          ...surchargeFields,
        });
      }
      toast.success('Parámetros guardados');
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los parámetros');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Parámetros legales ${year}`} open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">SMMLV</span>
            <input type="number" value={minimumWage} onChange={(e) => setMinimumWage(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Auxilio de transporte</span>
            <input type="number" value={transportAllowance} onChange={(e) => setTransportAllowance(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tope aux. transporte (x SMMLV)</span>
            <input type="number" step="0.1" value={capFactor} onChange={(e) => setCapFactor(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Salud empleado %</span>
            <input type="number" step="0.1" value={healthPct} onChange={(e) => setHealthPct(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Pensión empleado %</span>
            <input type="number" step="0.1" value={pensionPct} onChange={(e) => setPensionPct(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Divisor de horas mensual</span>
          <input type="number" value={monthlyDivisor} onChange={(e) => setMonthlyDivisor(e.target.value)} className={inputCls} />
        </label>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Recargos de horas (%)</p>
          <p className="text-[11px] text-gray-400 mb-2">Déjalos vacíos para usar la regla legal vigente por fecha (incluye el recargo dominical escalonado 90% desde jul-2026 y 100% desde jul-2027). Solo edítalos si necesitas fijar un valor distinto para este año específico.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ordinaria nocturna</span>
              <input type="number" step="0.1" placeholder="35 (default)" value={nightOrdinaryPct} onChange={(e) => setNightOrdinaryPct(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Extra diurna</span>
              <input type="number" step="0.1" placeholder="25 (default)" value={dayExtraPct} onChange={(e) => setDayExtraPct(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Extra nocturna</span>
              <input type="number" step="0.1" placeholder="75 (default)" value={nightExtraPct} onChange={(e) => setNightExtraPct(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dominical/festivo</span>
              <input type="number" step="0.1" placeholder="Escalonado por fecha" value={sundayHolidayPct} onChange={(e) => setSundayHolidayPct(e.target.value)} className={inputCls} />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar parámetros'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
