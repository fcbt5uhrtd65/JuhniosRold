import { useEffect, useState, useCallback } from 'react';
import { CreditCard, Check, X, Clock, AlertTriangle, FileText, FileSpreadsheet, Calendar, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';
import {
  getAdminPayments, openInvoicePdf, type AdminPayment, type AdminPaymentStatus,
} from '../../services/payments.service';
import {
  requestGenericReportExport, getGenericReportExportStatus, type InventoryReportExportFormat,
} from '../../services/reports.service';
import { pollExportStatus, downloadFile } from '../../utils/pollExportStatus';
import { resolveBackendUrl } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { KpiCard, Table, Th, Td, Badge, type BadgeColor, EmptyState } from './AdminUI';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu';

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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

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
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
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
  }, [currentPage, searchQuery, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleExport = async (exportFormat: InventoryReportExportFormat) => {
    setIsExporting(true);
    toast.info('Generando exportación…');
    try {
      const taskId = await requestGenericReportExport('payments', exportFormat, {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter,
        search: searchQuery || undefined,
      });
      const url = await pollExportStatus(taskId, getGenericReportExportStatus);
      await downloadFile(resolveBackendUrl(url));
      toast.success('Exportación lista.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al exportar');
    } finally {
      setIsExporting(false);
    }
  };

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
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-3">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-[#2a4038] text-white text-xs font-semibold transition hover:opacity-90 disabled:opacity-40"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Exportar
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => handleExport('pdf')}>
              <FileText className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} /> Facturas (PDF)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleExport('xlsx')}>
              <FileSpreadsheet className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} /> Listado (Excel)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filtro de fecha */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fecha desde</label>
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fecha hasta</label>
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
            />
          </div>
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Limpiar fechas
          </button>
        )}
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
