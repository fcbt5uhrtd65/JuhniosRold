import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ChevronDown, ChevronUp, FileDown, HandCoins, XCircle } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { useToast } from '../../contexts/ToastContext';
import { getEmployees, type Employee } from '../../services/employees.service';
import {
  approveVacationRequest,
  getLoanRequests,
  openVacationRequestPdf,
  rejectVacationRequest,
  type VacationRequest,
  type VacationRequestStatus,
} from '../../services/human-resources.service';
import { ActionsMenu, actionsCellCls, Badge, type BadgeColor, Card, Modal, Table, Th, Td, LoadingState, EmptyState } from './AdminUI';
import { SearchBar } from './SearchBar';
import { Pagination } from './Pagination';
import { SignaturePad } from './SignaturePad';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function getEmployeeName(employee: Employee | undefined): string {
  if (!employee) return 'Empleado';
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

function requestStatusLabel(status: VacationRequestStatus): string {
  const labels: Record<VacationRequestStatus, string> = {
    PENDING: 'Pendiente',
    IN_REVIEW: 'En revisión',
    PENDING_HR: 'Pendiente por RRHH',
    PENDING_ADMIN: 'Pendiente por Administrador',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
    CANCELLED: 'Cancelada',
    FINALIZED: 'Finalizada',
    EXPIRED: 'Vencida',
  };
  return labels[status];
}

function statusBadge(status: VacationRequestStatus): BadgeColor {
  const colors: Record<VacationRequestStatus, BadgeColor> = {
    PENDING: 'yellow',
    IN_REVIEW: 'purple',
    PENDING_HR: 'purple',
    PENDING_ADMIN: 'yellow',
    APPROVED: 'green',
    REJECTED: 'red',
    CANCELLED: 'gray',
    FINALIZED: 'blue',
    EXPIRED: 'red',
  };
  return colors[status];
}

function parseLocalDate(value: string): Date {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(value);
}

function formatDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('es-CO');
}

function formatDayLabel(value: string): string {
  return parseLocalDate(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString('es-CO')} COP`;
}

function formatMoneyCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

const LOAN_FREQUENCY_LABELS: Record<string, string> = {
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

const NON_ACTIVE_STATUSES: VacationRequestStatus[] = ['REJECTED', 'CANCELLED'];

interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  total: number;
}

function buildBreakdown(loans: VacationRequest[], keyFn: (loan: VacationRequest) => string, labelFn: (key: string) => string): BreakdownRow[] {
  const map = new Map<string, { count: number; total: number }>();
  for (const loan of loans) {
    const key = keyFn(loan);
    const amount = loan.loan_amount ? Number(loan.loan_amount) : 0;
    const entry = map.get(key) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += amount;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, label: labelFn(key), count: value.count, total: value.total }))
    .sort((a, b) => b.total - a.total);
}

function BreakdownList({ title, rows, maxTotal }: { title: string; rows: BreakdownRow[]; maxTotal: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-900">
        <BarChart3 size={14} className="flex-shrink-0" />
        {title}
      </div>
      <div className="space-y-2.5">
        {rows.slice(0, 8).map((row) => (
          <div key={row.key} className="text-xs">
            <div className="flex justify-between gap-2 mb-1 text-gray-600">
              <span className="truncate">{row.label}</span>
              <span className="flex-shrink-0 font-semibold text-gray-900">{formatMoneyCompact(row.total)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2a4038]"
                style={{ width: `${maxTotal > 0 ? Math.max((row.total / maxTotal) * 100, 4) : 0}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{row.count} solicitud{row.count === 1 ? '' : 'es'}</div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-[11px] text-gray-400">Sin datos para los filtros aplicados.</p>}
      </div>
    </Card>
  );
}

const MANAGEABLE_LOAN_STATUSES: VacationRequestStatus[] = ['PENDING', 'IN_REVIEW', 'PENDING_HR', 'PENDING_ADMIN'];

export function AdminLoans() {
  const toast = useToast();
  const { currentUser } = useAdmin();
  // Solo Administrador o Tesorería pueden aprobar/rechazar préstamos. RRHH y
  // Contabilidad ven la información completa (incluida esta pantalla), pero
  // no deciden — solo consultan y descargan el PDF.
  const canManage = currentUser?.rol === 'ADMIN' || currentUser?.rol === 'TESORERIA';
  const [isLoading, setIsLoading] = useState(true);
  const [loans, setLoans] = useState<VacationRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [decisionRequest, setDecisionRequest] = useState<{ loan: VacationRequest; decision: 'approve' | 'reject' } | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionSignature, setDecisionSignature] = useState<File | null>(null);
  const [decisionSaving, setDecisionSaving] = useState(false);

  const loadLoans = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    const [loansRes, employeesRes] = await Promise.allSettled([getLoanRequests({ limit: 200 }), getEmployees({ limit: 500 })]);
    if (loansRes.status === 'fulfilled') {
      setLoans(loansRes.value.data);
    } else {
      toast.error('No se pudieron cargar las solicitudes de préstamo');
    }
    if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
    if (!options?.silent) setIsLoading(false);
  };

  useEffect(() => {
    void loadLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDecisionModal = (loan: VacationRequest, decision: 'approve' | 'reject') => {
    setDecisionComment('');
    setDecisionSignature(null);
    setDecisionRequest({ loan, decision });
  };

  const closeDecisionModal = () => {
    setDecisionRequest(null);
    setDecisionComment('');
    setDecisionSignature(null);
  };

  const confirmDecision = async () => {
    if (!decisionRequest) return;
    const { loan, decision } = decisionRequest;
    if (decision === 'reject' && !decisionComment.trim()) {
      toast.error('Debes indicar el motivo del rechazo');
      return;
    }
    setDecisionSaving(true);
    try {
      if (decision === 'approve') {
        await approveVacationRequest(loan.id, decisionComment.trim(), decisionSignature);
        toast.success('Préstamo aprobado');
      } else {
        await rejectVacationRequest(loan.id, decisionComment.trim(), decisionSignature);
        toast.info('Préstamo rechazado');
      }
      closeDecisionModal();
      await loadLoans({ silent: true });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la decisión');
    } finally {
      setDecisionSaving(false);
    }
  };

  const handleViewPdf = async (loan: VacationRequest) => {
    try {
      await openVacationRequestPdf(loan.id);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo abrir el documento del préstamo');
    }
  };

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const filteredLoans = useMemo(() => {
    const search = query.toLowerCase().trim();
    if (!search) return loans;
    return loans.filter((loan) => {
      const employee = employeeById.get(loan.employee);
      const employeeName = getEmployeeName(employee).toLowerCase();
      return (
        employeeName.includes(search) ||
        (loan.loan_requester_name ?? '').toLowerCase().includes(search) ||
        (loan.loan_requester_document ?? '').includes(search) ||
        (loan.loan_expense_number ?? '').toLowerCase().includes(search) ||
        (loan.request_number ?? '').toLowerCase().includes(search)
      );
    });
  }, [loans, query, employeeById]);

  const summary = useMemo(() => {
    const activeLoans = filteredLoans.filter((loan) => !NON_ACTIVE_STATUSES.includes(loan.status));
    const totalRequested = filteredLoans.reduce((sum, loan) => sum + (loan.loan_amount ? Number(loan.loan_amount) : 0), 0);
    const totalActive = activeLoans.reduce((sum, loan) => sum + (loan.loan_amount ? Number(loan.loan_amount) : 0), 0);
    const totalApproved = filteredLoans
      .filter((loan) => loan.status === 'APPROVED' || loan.status === 'FINALIZED')
      .reduce((sum, loan) => sum + (loan.loan_amount ? Number(loan.loan_amount) : 0), 0);
    const pendingCount = filteredLoans.filter((loan) => ['PENDING', 'IN_REVIEW', 'PENDING_HR', 'PENDING_ADMIN'].includes(loan.status)).length;
    const average = filteredLoans.length > 0 ? totalRequested / filteredLoans.length : 0;
    return { totalRequested, totalActive, totalApproved, pendingCount, average, count: filteredLoans.length };
  }, [filteredLoans]);

  const byMonth = useMemo(
    () => buildBreakdown(filteredLoans, (loan) => loan.start_date.slice(0, 7), formatMonthLabel).sort((a, b) => (a.key < b.key ? 1 : -1)),
    [filteredLoans],
  );
  const byDay = useMemo(
    () => buildBreakdown(filteredLoans, (loan) => loan.start_date, formatDayLabel).sort((a, b) => (a.key < b.key ? 1 : -1)),
    [filteredLoans],
  );
  const byEmployee = useMemo(
    () => buildBreakdown(filteredLoans, (loan) => loan.employee, (key) => {
      const employee = employeeById.get(key);
      const loan = filteredLoans.find((item) => item.employee === key);
      return loan?.loan_requester_name || getEmployeeName(employee);
    }),
    [filteredLoans, employeeById],
  );

  const maxMonthTotal = useMemo(() => Math.max(...byMonth.map((row) => row.total), 1), [byMonth]);
  const maxDayTotal = useMemo(() => Math.max(...byDay.map((row) => row.total), 1), [byDay]);
  const maxEmployeeTotal = useMemo(() => Math.max(...byEmployee.map((row) => row.total), 1), [byEmployee]);

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / pageSize));
  const paginatedLoans = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLoans.slice(start, start + pageSize);
  }, [filteredLoans, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  if (isLoading) {
    return <LoadingState label="Cargando solicitudes de préstamo..." />;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <HandCoins size={16} className="text-gray-400 flex-shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900">Préstamos</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Solicitudes de préstamo de empleados, para registro y control contable.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Solicitudes</div>
          <div className="text-lg font-bold text-gray-900">{summary.count}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Pendientes</div>
          <div className="text-lg font-bold text-gray-900">{summary.pendingCount}</div>
        </Card>
        <Card className="p-3 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Total solicitado</div>
          <div className="text-lg font-bold text-gray-900 truncate" title={formatMoney(summary.totalRequested)}>{formatMoneyCompact(summary.totalRequested)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Aprobado</div>
          <div className="text-lg font-bold text-emerald-700 truncate" title={formatMoney(summary.totalApproved)}>{formatMoneyCompact(summary.totalApproved)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Promedio</div>
          <div className="text-lg font-bold text-gray-900 truncate" title={formatMoney(summary.average)}>{formatMoneyCompact(summary.average)}</div>
        </Card>
      </div>

      <button
        type="button"
        onClick={() => setShowBreakdown((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors mb-4"
      >
        <span className="flex items-center gap-2 min-w-0">
          <BarChart3 size={14} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">Desglose por mes, día y empleado</span>
        </span>
        {showBreakdown ? <ChevronUp size={14} className="flex-shrink-0" /> : <ChevronDown size={14} className="flex-shrink-0" />}
      </button>

      {showBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <BreakdownList title="Por mes" rows={byMonth} maxTotal={maxMonthTotal} />
          <BreakdownList title="Por día" rows={byDay} maxTotal={maxDayTotal} />
          <BreakdownList title="Por empleado" rows={byEmployee} maxTotal={maxEmployeeTotal} />
        </div>
      )}

      <Card className="p-4 sm:p-6">
        {loans.length > 0 && (
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar por empleado, cédula o número de egreso..." className="mb-4" />
        )}

        <Table>
          <thead>
            <tr>
              <Th>Empleado</Th>
              <Th>Concepto</Th>
              <Th>Monto</Th>
              <Th>Forma de pago</Th>
              <Th>N.º egreso</Th>
              <Th>Fecha</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedLoans.map((loan) => {
              const employee = employeeById.get(loan.employee);
              const isManageable = MANAGEABLE_LOAN_STATUSES.includes(loan.status);
              return (
                <tr key={loan.id}>
                  <Td>
                    <div className="font-medium text-gray-900">{loan.loan_requester_name || getEmployeeName(employee)}</div>
                    <div className="text-xs text-gray-400">{loan.loan_requester_document || employee?.employee_code}</div>
                  </Td>
                  <Td>{loan.loan_concept || '—'}</Td>
                  <Td className="font-semibold">{loan.loan_amount ? formatMoney(Number(loan.loan_amount)) : '—'}</Td>
                  <Td>
                    {loan.loan_frequency ? LOAN_FREQUENCY_LABELS[loan.loan_frequency] ?? loan.loan_frequency : '—'}
                    {loan.loan_installments_count ? ` · ${loan.loan_installments_count} cuotas` : ''}
                  </Td>
                  <Td>{loan.loan_expense_number || '—'}</Td>
                  <Td>{formatDate(loan.start_date)}</Td>
                  <Td>
                    <Badge label={requestStatusLabel(loan.status)} color={statusBadge(loan.status)} />
                  </Td>
                  <Td className={actionsCellCls} onClick={(e) => e.stopPropagation()}>
                    <ActionsMenu
                      items={[
                        { label: 'Ver PDF', icon: FileDown, onClick: () => void handleViewPdf(loan) },
                        ...(canManage ? [
                          { label: 'Aprobar', icon: Check, onClick: () => openDecisionModal(loan, 'approve'), disabled: !isManageable },
                          { label: 'Rechazar', icon: XCircle, onClick: () => openDecisionModal(loan, 'reject'), disabled: !isManageable },
                        ] : []),
                      ]}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        {loans.length === 0 && <EmptyState title="No hay solicitudes de préstamo registradas." />}
        {loans.length > 0 && filteredLoans.length === 0 && <EmptyState title="Ninguna solicitud coincide con tu búsqueda." />}

        {filteredLoans.length > 0 && (
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredLoans.length}
              itemsPerPage={pageSize}
              itemsPerPageOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onItemsPerPageChange={setPageSize}
            />
          </div>
        )}
      </Card>

      <Modal
        title={decisionRequest?.decision === 'reject' ? 'Rechazar préstamo' : 'Aprobar préstamo'}
        open={Boolean(decisionRequest)}
        onClose={closeDecisionModal}
      >
        {decisionRequest && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              {(() => {
                const employee = employeeById.get(decisionRequest.loan.employee);
                const name = decisionRequest.loan.loan_requester_name || getEmployeeName(employee);
                const amount = decisionRequest.loan.loan_amount ? formatMoney(Number(decisionRequest.loan.loan_amount)) : '—';
                return `Préstamo de ${name} por ${amount}. Esta acción queda registrada en el historial.`;
              })()}
            </p>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
                Comentario {decisionRequest.decision === 'reject' && '(obligatorio)'}
              </label>
              <textarea
                value={decisionComment}
                onChange={(event) => setDecisionComment(event.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] transition-all resize-none"
                placeholder={decisionRequest.decision === 'reject' ? 'Indica el motivo del rechazo' : 'Comentario opcional'}
              />
            </div>
            <SignaturePad
              label="Tu firma para esta decisión"
              helperText="Se usará tu firma guardada por defecto. Si quieres firmar distinto solo para esta solicitud, dibuja o sube una firma aquí."
              onChange={setDecisionSignature}
            />
            <div className="flex justify-end gap-2">
              <button onClick={closeDecisionModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => void confirmDecision()}
                disabled={decisionSaving}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40 ${
                  decisionRequest.decision === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {decisionSaving ? 'Guardando...' : decisionRequest.decision === 'reject' ? 'Rechazar' : 'Aprobar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
