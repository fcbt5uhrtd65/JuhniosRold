import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Plus,
  UploadCloud,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  Badge,
  type BadgeColor,
  Card,
  EmptyState,
  KpiCard,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TabBar,
  inputCls,
  selectCls,
} from './AdminUI';
import {
  approvePayrollPeriod,
  calculatePayrollPeriod,
  consolidateBiometricBatch,
  correctAttendance,
  createBiometricDevice,
  createEmployeeBiometricId,
  createPayrollLegalParameter,
  createPayrollPeriod,
  deleteEmployeeBiometricId,
  generateYearHolidays,
  getBiometricDevices,
  getBiometricImportBatches,
  getEmployeeBiometricIds,
  getEmployeeWorkSchedules,
  getPayrollLegalParameters,
  getPayrollPeriods,
  getPendingCorrectionAttendance,
  getPublicHolidays,
  markPayrollPeriodPaid,
  setEmployeeWorkSchedule,
  updatePayrollLegalParameter,
  uploadBiometricFile,
  type Attendance,
  type BiometricDevice,
  type BiometricImportBatch,
  type EmployeeBiometricId,
  type EmployeeWorkSchedule,
  type PayrollLegalParameter,
  type PayrollPeriod,
  type PayrollPeriodStatus,
  type PublicHoliday,
} from '../../services/human-resources.service';
import { getEmployees, type Employee } from '../../services/employees.service';

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
      toast.error(error instanceof Error ? error.message : 'No se pudo calcular el período');
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

function SchedulesSection({ employees, employeeById }: { employees: Employee[]; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [schedules, setSchedules] = useState<EmployeeWorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmployeeWorkSchedules({ is_active: true });
      setSchedules(data);
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

  if (loading) return <LoadingState label="Cargando horarios..." />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setShowModal(true)} icon={<Plus size={14} />}>Asignar horario</PrimaryButton>
      </div>

      {schedules.length === 0 ? (
        <EmptyState title="Sin horarios asignados" description="Cada empleado necesita un horario esperado para calcular horas ordinarias/extra correctamente." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="p-4">
              <p className="text-xs font-semibold text-gray-900 mb-1">{employeeName(employeeById.get(schedule.employee))}</p>
              <p className="text-[11px] text-gray-400 mb-3">Vigente desde {formatDate(schedule.start_date)}</p>
              <div className="space-y-1">
                {schedule.days.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin franjas configuradas.</p>
                ) : (
                  schedule.days.map((day) => (
                    <div key={day.id} className="flex items-center justify-between text-[11px] text-gray-600">
                      <span>{WEEKDAY_LABELS[day.weekday]}</span>
                      <span>{day.expected_start_time.slice(0, 5)} - {day.expected_end_time.slice(0, 5)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewScheduleModal
        open={showModal}
        employees={employees}
        onClose={() => setShowModal(false)}
        onCreated={async () => {
          setShowModal(false);
          await load();
        }}
      />
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
  onClose,
  onCreated,
}: {
  open: boolean;
  employees: Employee[];
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
      setEmployeeId('');
      setStartDate('');
      setDays(defaultWeekdayForm());
    }
  }, [open]);

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
      toast.error(error instanceof Error ? error.message : 'No se pudo asignar el horario');
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

/* ───────────────────────── Biométrico ───────────────────────── */

function BiometricSection({ employees, employeeById }: { employees: Employee[]; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [mappings, setMappings] = useState<EmployeeBiometricId[]>([]);
  const [batches, setBatches] = useState<BiometricImportBatch[]>([]);
  const [pending, setPending] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState<Attendance | null>(null);
  const [uploadingDevice, setUploadingDevice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [consolidatingId, setConsolidatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, mappingsRes, batchesRes, pendingRes] = await Promise.allSettled([
        getBiometricDevices(),
        getEmployeeBiometricIds(),
        getBiometricImportBatches(),
        getPendingCorrectionAttendance(),
      ]);
      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value);
      if (mappingsRes.status === 'fulfilled') setMappings(mappingsRes.value);
      if (batchesRes.status === 'fulfilled') setBatches(batchesRes.value);
      if (pendingRes.status === 'fulfilled') setPending(pendingRes.value);
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
    setUploading(true);
    try {
      const batch = await uploadBiometricFile(file, uploadingDevice || undefined);
      toast.success(`Archivo procesado: ${batch.matched_rows} marcaciones asociadas, ${batch.unmatched_rows} sin empleado, ${batch.duplicate_rows} duplicadas.`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo importar el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleConsolidate = async (batchId: string) => {
    setConsolidatingId(batchId);
    try {
      const summary = await consolidateBiometricBatch(batchId);
      toast.success(`Asistencia consolidada: ${summary.created} creadas, ${summary.updated} actualizadas, ${summary.incomplete} incompletas.`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo consolidar la importación');
    } finally {
      setConsolidatingId(null);
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

  if (loading) return <LoadingState label="Cargando información biométrica..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Importar archivo del reloj biométrico</p>
          <SecondaryButton onClick={() => setShowDeviceModal(true)} icon={<Plus size={13} />}>Nuevo dispositivo</SecondaryButton>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <label className="block flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dispositivo (opcional)</span>
            <select value={uploadingDevice} onChange={(e) => setUploadingDevice(e.target.value)} className={selectCls}>
              <option value="">Sin especificar</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors cursor-pointer disabled:opacity-50">
            <UploadCloud size={14} />
            {uploading ? 'Subiendo...' : 'Subir archivo'}
            <input
              type="file"
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

      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Importaciones recientes</p>
        {batches.length === 0 ? (
          <EmptyState title="Sin importaciones todavía" />
        ) : (
          <div className="space-y-2">
            {batches.map((batch) => (
              <div key={batch.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{formatDateTime(batch.created_at)}</p>
                  <p className="text-[11px] text-gray-400">
                    {batch.matched_rows} asociadas · {batch.unmatched_rows} sin empleado · {batch.duplicate_rows} duplicadas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={batch.status} color={batch.status === 'COMPLETED' ? 'green' : batch.status === 'FAILED' ? 'red' : 'yellow'} />
                  {batch.status === 'COMPLETED' && (
                    <SecondaryButton onClick={() => void handleConsolidate(batch.id)} disabled={consolidatingId === batch.id}>
                      {consolidatingId === batch.id ? 'Consolidando...' : 'Consolidar en asistencia'}
                    </SecondaryButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Mapeo de códigos del reloj a empleados</p>
          <SecondaryButton onClick={() => setShowMappingModal(true)} icon={<Plus size={13} />}>Nuevo mapeo</SecondaryButton>
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
    </div>
  );
}

function NewBiometricMappingModal({
  open,
  employees,
  devices,
  onClose,
  onCreated,
}: {
  open: boolean;
  employees: Employee[];
  devices: BiometricDevice[];
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
      setBiometricCode('');
    }
  }, [open]);

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMinimumWage(existing?.minimum_wage ?? '');
    setTransportAllowance(existing?.transport_allowance_amount ?? '');
    setCapFactor(existing?.transport_allowance_salary_cap_factor ?? '2');
    setHealthPct(existing?.health_employee_pct ?? '4');
    setPensionPct(existing?.pension_employee_pct ?? '4');
    setMonthlyDivisor(existing?.monthly_hours_divisor_default ?? '230');
  }, [open, existing]);

  const handleSubmit = async () => {
    if (!minimumWage) {
      toast.warning('Indica el valor del SMMLV.');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updatePayrollLegalParameter(existing.id, {
          minimum_wage: minimumWage,
          transport_allowance_amount: transportAllowance || 0,
          transport_allowance_salary_cap_factor: capFactor,
          health_employee_pct: healthPct,
          pension_employee_pct: pensionPct,
          monthly_hours_divisor_default: monthlyDivisor,
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
