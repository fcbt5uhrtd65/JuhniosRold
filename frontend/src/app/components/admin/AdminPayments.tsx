import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Check, X, Clock, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';
import {
  getAdminPayments, openInvoicePdf, type AdminPayment, type AdminPaymentStatus,
} from '../../services/payments.service';
import { useToast } from '../../contexts/ToastContext';

const STATUS_LABELS: Record<AdminPaymentStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  DECLINED: 'Rechazado',
  ERROR: 'Error',
  VOIDED: 'Anulado',
  EXPIRED: 'Expirado',
};

const STATUS_COLORS: Record<AdminPaymentStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
  ERROR: 'bg-red-100 text-red-800',
  VOIDED: 'bg-gray-100 text-gray-700',
  EXPIRED: 'bg-gray-100 text-gray-700',
};

function StatusIcon({ status }: { status: AdminPaymentStatus }) {
  if (status === 'APPROVED') return <Check className="w-4 h-4" strokeWidth={1} />;
  if (status === 'PENDING') return <Clock className="w-4 h-4" strokeWidth={1} />;
  return <X className="w-4 h-4" strokeWidth={1} />;
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-2">Pagos</h1>
        <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          {total} transacciones registradas
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Aprobados (página)
          </div>
          <div className="text-xl">{stats.aprobados}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Pendientes (página)
          </div>
          <div className="text-xl">{stats.pendientes}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Rechazados (página)
          </div>
          <div className="text-xl">{stats.rechazados}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Total Procesado (página)
          </div>
          <div className="text-xl">${(stats.total / 1000).toFixed(0)}k</div>
        </motion.div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
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
        <div className="bg-red-50 border border-red-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4" strokeWidth={1} />
            {errorMessage}
          </div>
          <button
            onClick={loadPayments}
            className="px-3 py-1.5 border border-red-300 text-red-700 text-xs uppercase tracking-wider hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-secondary border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Pedido
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Proveedor
                </th>
                <th className="px-4 py-3 text-right text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Monto
                </th>
                <th className="px-4 py-3 text-center text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Referencia
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Fecha
                </th>
                <th className="px-4 py-3 text-center text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Factura
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-background/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-xs font-mono">{payment.orderNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">{payment.customerName || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" strokeWidth={1} />
                      <div className="text-xs">{payment.provider === 'WOMPI' ? 'Wompi' : 'Simulado'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-sm font-medium">${payment.amount.toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 ${STATUS_COLORS[payment.status]}`}>
                      <StatusIcon status={payment.status} />
                      <span>{STATUS_LABELS[payment.status]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-mono text-muted-foreground">
                      {payment.reference}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(payment.createdAt), 'dd/MM/yyyy')}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(payment.createdAt), 'HH:mm')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {payment.invoiceId ? (
                      <button
                        onClick={() => handleViewInvoice(payment.invoiceId!)}
                        disabled={loadingInvoiceId === payment.invoiceId}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 border border-border hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                        title={payment.invoiceNumber ?? undefined}
                      >
                        <FileText className="w-3.5 h-3.5" strokeWidth={1} />
                        Ver factura
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {status === 'success' && payments.length === 0 && (
        <div className="bg-secondary border border-border p-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" strokeWidth={1} />
          <div className="text-sm text-muted-foreground">
            No hay transacciones registradas
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
