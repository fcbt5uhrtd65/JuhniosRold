import { useEffect, useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { getEmployees, type Employee } from '../../services/employees.service';
import { getLoanRequests, type VacationRequest, type VacationRequestStatus } from '../../services/human-resources.service';
import { Badge, type BadgeColor, Card, Table, Th, Td, LoadingState, EmptyState } from './AdminUI';
import { SearchBar } from './SearchBar';
import { Pagination } from './Pagination';

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

function formatDate(value: string): string {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-CO');
  }
  return new Date(value).toLocaleDateString('es-CO');
}

function formatMoney(value: string | null): string {
  if (!value) return '—';
  return `$${Number(value).toLocaleString('es-CO')} COP`;
}

const LOAN_FREQUENCY_LABELS: Record<string, string> = {
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

export function AdminLoans() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [loans, setLoans] = useState<VacationRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.allSettled([getLoanRequests({ limit: 200 }), getEmployees({ limit: 500 })]).then(([loansRes, employeesRes]) => {
      if (cancelled) return;
      if (loansRes.status === 'fulfilled') {
        setLoans(loansRes.value.data);
      } else {
        toast.error('No se pudieron cargar las solicitudes de préstamo');
      }
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [toast]);

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
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <HandCoins size={16} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Préstamos</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Solicitudes de préstamo de empleados, para registro y control contable.
          </p>
        </div>
      </div>

      <Card className="p-6">
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
            </tr>
          </thead>
          <tbody>
            {paginatedLoans.map((loan) => {
              const employee = employeeById.get(loan.employee);
              return (
                <tr key={loan.id}>
                  <Td>
                    <div className="font-medium text-gray-900">{loan.loan_requester_name || getEmployeeName(employee)}</div>
                    <div className="text-xs text-gray-400">{loan.loan_requester_document || employee?.employee_code}</div>
                  </Td>
                  <Td>{loan.loan_concept || '—'}</Td>
                  <Td className="font-semibold">{formatMoney(loan.loan_amount)}</Td>
                  <Td>
                    {loan.loan_frequency ? LOAN_FREQUENCY_LABELS[loan.loan_frequency] ?? loan.loan_frequency : '—'}
                    {loan.loan_installments_count ? ` · ${loan.loan_installments_count} cuotas` : ''}
                  </Td>
                  <Td>{loan.loan_expense_number || '—'}</Td>
                  <Td>{formatDate(loan.start_date)}</Td>
                  <Td>
                    <Badge label={requestStatusLabel(loan.status)} color={statusBadge(loan.status)} />
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
    </div>
  );
}
