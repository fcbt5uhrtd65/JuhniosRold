import { useEffect, useState, useCallback } from 'react';
import { CreditCard, Check, X, Clock, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';
import {
  getAdminPayments, openInvoicePdf, type AdminPayment, type AdminPaymentStatus,
} from '../../services/payments.service';
import { useToast } from '../../contexts/ToastContext';
import { KpiCard, Table, Th, Td, Badge, type BadgeColor, EmptyState } from './AdminUI';

const STATUS_LABELS: Record<AdminPaymentStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  DECLINED: 'Rechazado',
  ERROR: 'Error',
  VOIDED: 'Anulado',
  EXPIRED: 'Expirado',
};

const STATUS_COLORS: Record<AdminPaymentStatus, BadgeColor> = {
  PENDING: 'yellow',
  APPROVED: 'green',
  DECLINED: 'red',
  ERROR: 'red',
  VOIDED: 'gray',
  EXPIRED: 'gray',
};

function StatusIcon({ status }: { status: AdminPaymentStatus }) {
  if (status === 'APPROVED') return <Check size={12} />;
  if (status === 'PENDING') return <Clock size={12} />;
  return <X size={12} />;
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    id: 'status',
    label: 'Estado',
    multiple: false,
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value })),
  },
];

const PAGE_SIZE = 20;

export function AdminPayments() {
  const toast = useToast();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);

  const handleViewInvoice = async (invoiceId: string) => {
    setLoadingInvoiceId(invoiceId);
    try {
      await openInvoicePdf(invoiceId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir la factura');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const statusFilter = activeFilters.status?.[0] as AdminPaymentStatus | undefined;

  const loadPayments = useCallback(() => {
    setStatus('loading');
    getAdminPayments({
      page: currentPage,
      pageSize: PAGE_SIZE,
      search: searchQuery || undefined,
      status: statusFilter,
    })
      .then(result => {
        setPayments(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setStatus('success');
      })
      .catch(error => {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los pagos.');
        setStatus('error');
      });
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const stats = {
    aprobados: payments.filter(p => p.status === 'APPROVED').length,
    pendientes: payments.filter(p => p.status === 'PENDING').length,
    rechazados: payments.filter(p => p.status === 'DECLINED' || p.status === 'ERROR').length,
    total: payments.reduce((sum, p) => p.status === 'APPROVED' ? sum + p.amount : sum, 0),
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Pagos</h2>
        <p className="text-xs text-gray-500 mt-0.5">{total} transacciones registradas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Aprobados (página)" value={String(stats.aprobados)} icon={Check} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Pendientes (página)" value={String(stats.pendientes)} icon={Clock} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Rechazados (página)" value={String(stats.rechazados)} icon={X} color="text-red-600 bg-red-50" />
        <KpiCard label="Total Procesado (página)" value={`$${(stats.total / 1000).toFixed(0)}k`} icon={CreditCard} color="text-[#2a4038] bg-[#2a4038]/10" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <SearchBar
          value={searchQuery}
          onChange={v => { setSearchQuery(v); setCurrentPage(1); }}
          placeholder="Buscar por referencia, pedido o cliente..."
          className="flex-1"
        />
        <FilterPanel
          filters={FILTER_GROUPS}
          activeFilters={activeFilters}
          onFilterChange={(id, vals) => { setActiveFilters(prev => ({ ...prev, [id]: vals })); setCurrentPage(1); }}
          onClearAll={() => { setActiveFilters({}); setCurrentPage(1); }}
        />
      </div>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle size={15} />
            {errorMessage}
          </div>
          <button
            onClick={loadPayments}
            className="px-3 py-1.5 border border-red-200 rounded-lg text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Payments Table */}
      <Table>
        <thead>
          <tr>
            <Th>Pedido</Th>
            <Th>Cliente</Th>
            <Th>Proveedor</Th>
            <Th>Monto</Th>
            <Th>Estado</Th>
            <Th>Referencia</Th>
            <Th>Fecha</Th>
            <Th>Factura</Th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="hover:bg-gray-50/50">
              <Td><span className="font-mono text-xs">{payment.orderNumber}</span></Td>
              <Td>{payment.customerName || '—'}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <CreditCard size={14} className="text-gray-400" />
                  {payment.provider === 'WOMPI' ? 'Wompi' : 'Simulado'}
                </div>
              </Td>
              <Td className="font-semibold">${payment.amount.toLocaleString()}</Td>
              <Td>
                <Badge label={
                  <span className="flex items-center gap-1">
                    <StatusIcon status={payment.status} />
                    {STATUS_LABELS[payment.status]}
                  </span>
                } color={STATUS_COLORS[payment.status]} />
              </Td>
              <Td><span className="font-mono text-xs text-gray-400">{payment.reference}</span></Td>
              <Td>
                <div className="text-gray-600">{format(new Date(payment.createdAt), 'dd/MM/yyyy')}</div>
                <div className="text-[11px] text-gray-400">{format(new Date(payment.createdAt), 'HH:mm')}</div>
              </Td>
              <Td>
                {payment.invoiceId ? (
                  <button
                    onClick={() => handleViewInvoice(payment.invoiceId!)}
                    disabled={loadingInvoiceId === payment.invoiceId}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={payment.invoiceNumber ?? undefined}
                  >
                    <FileText size={12} />
                    Ver factura
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-400">—</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {status === 'success' && payments.length === 0 && (
        <EmptyState title="No hay transacciones registradas" />
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
