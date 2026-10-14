import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Eye, FileDown, FileText, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  deletePaymentAccount,
  getPaymentAccount,
  getPaymentAccounts,
  type PaymentAccount,
  type PaymentAccountPage,
} from '../../services/payment-accounts.service';
import { formatCOP, formatNumber, longDate } from '../../utils/documentText';
import { downloadPaymentAccountPdf } from '../../utils/paymentAccountPdf';
import { downloadPaymentAccountDocx } from '../../utils/paymentAccountDocx';
import { PageHeader, Badge, Card, EmptyState, LoadingState, TabBar } from './AdminUI';
import { PaymentAccountForm } from './PaymentAccountForm';
import { PaymentAccountViewer } from './PaymentAccountViewer';

type Tab = 'new' | 'history';

const PAGE_SIZE = 10;
const filterCls =
  'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-[#2a4038] focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20';

export function AdminPaymentAccounts() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('new');
  const [previous, setPrevious] = useState<PaymentAccount[]>([]);
  const [duplicate, setDuplicate] = useState<{ account: PaymentAccount; nonce: number } | null>(null);

  // --- Historial ---
  const [filters, setFilters] = useState({ name: '', id_number: '', date_from: '', date_to: '' });
  const [debounced, setDebounced] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaymentAccountPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PaymentAccount | null>(null);
  const requestRef = useRef(0);

  // Debounce de 250 ms sobre los filtros.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(filters);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const loadHistory = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const result = await getPaymentAccounts({ ...debounced, page, page_size: PAGE_SIZE });
      if (requestId === requestRef.current) setData(result);
    } catch (error) {
      if (requestId === requestRef.current) {
        toast.error(error instanceof Error ? error.message : 'No se pudo cargar el historial');
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, page]);

  useEffect(() => {
    if (tab === 'history') void loadHistory();
  }, [tab, loadHistory]);

  // Cuentas previas para "¿Mismo contratista de antes?" y el autocompletado.
  const loadPrevious = useCallback(async () => {
    try {
      const result = await getPaymentAccounts({ page: 1, page_size: 100 });
      setPrevious(result.results);
    } catch {
      setPrevious([]);
    }
  }, []);

  useEffect(() => {
    void loadPrevious();
  }, [loadPrevious]);

  const withFull = async (account: PaymentAccount, action: (full: PaymentAccount) => void | Promise<void>) => {
    setBusyId(account.id);
    try {
      const full = await getPaymentAccount(account.id);
      await action(full);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la acción');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (account: PaymentAccount) => {
    if (!window.confirm(`¿Eliminar la cuenta de cobro No. ${formatNumber(account.number)}? El consecutivo no se reutiliza.`)) return;
    setBusyId(account.id);
    try {
      await deletePaymentAccount(account.id);
      toast.success('Cuenta de cobro eliminada');
      await Promise.all([loadHistory(), loadPrevious()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    } finally {
      setBusyId(null);
    }
  };

  const clearFilters = () => setFilters({ name: '', id_number: '', date_from: '', date_to: '' });
  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.max(1, data?.total_pages ?? 1);
  const iconBtn = 'rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40';

  return (
    <div>
      <PageHeader title="Cuenta de cobro" subtitle="Crea, consulta y descarga cuentas de cobro de contratistas." />

      <div className="mb-4">
        <TabBar
          tabs={[
            { id: 'new' as Tab, label: 'Nueva cuenta', icon: FileText },
            { id: 'history' as Tab, label: 'Historial', icon: Eye },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* El formulario se mantiene montado para no perder lo escrito al cambiar de pestaña. */}
      <div className={tab === 'new' ? '' : 'hidden'}>
        <PaymentAccountForm
          previousAccounts={previous}
          duplicate={duplicate}
          onCreated={() => {
            void loadPrevious();
          }}
        />
      </div>

      {tab === 'history' && (
        <div className="space-y-3">
          <Card className="p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Nombre
                <input className={filterCls} placeholder="Prestador o cliente" value={filters.name} onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                No.
                <input className={`${filterCls} w-24`} inputMode="numeric" placeholder="004" value={filters.id_number} onChange={(e) => setFilters((f) => ({ ...f, id_number: e.target.value.replace(/\D/g, '') }))} />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Desde
                <input type="date" className={filterCls} value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Hasta
                <input type="date" className={filterCls} value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} />
              </label>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="pb-1.5 text-xs font-semibold text-[#2a4038] underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          </Card>

          <Card>
            {loading && !data ? (
              <LoadingState label="Cargando cuentas de cobro…" />
            ) : !data || data.results.length === 0 ? (
              <EmptyState title="Sin cuentas de cobro" description={hasFilters ? 'Ningún resultado con estos filtros.' : 'Crea la primera desde "Nueva cuenta".'} />
            ) : (
              <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-3 py-2">No.</th>
                      <th className="px-3 py-2">Prestador y concepto</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2">Certificado</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.results.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2 font-semibold text-gray-900">{formatNumber(a.number)}</td>
                        <td className="max-w-[260px] px-3 py-2">
                          <p className="font-medium text-gray-900">{a.contractor_name}</p>
                          <p className="truncate text-gray-500">{a.service_title}</p>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{a.client_name}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{longDate(a.issue_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-gray-900">{formatCOP(a.amount)}</td>
                        <td className="px-3 py-2">
                          <Badge label={a.no_withholding_letter ? 'Incluido' : 'No'} color={a.no_withholding_letter ? 'green' : 'gray'} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {busyId === a.id ? (
                            <Loader2 size={14} className="inline animate-spin text-gray-400" />
                          ) : (
                            <>
                              <button type="button" title="Ver" className={iconBtn} onClick={() => void withFull(a, (full) => setViewing(full))}>
                                <Eye size={14} />
                              </button>
                              <button type="button" title="PDF" className={iconBtn} onClick={() => void withFull(a, (full) => downloadPaymentAccountPdf(full, { withSignature: Boolean(full.signature) }))}>
                                <FileDown size={14} />
                              </button>
                              <button type="button" title="Word" className={iconBtn} onClick={() => void withFull(a, (full) => downloadPaymentAccountDocx(full, { withSignature: Boolean(full.signature) }))}>
                                <FileText size={14} />
                              </button>
                              <button
                                type="button"
                                title="Duplicar"
                                className={iconBtn}
                                onClick={() =>
                                  void withFull(a, (full) => {
                                    setDuplicate({ account: full, nonce: Date.now() });
                                    setTab('new');
                                    toast.success('Formulario llenado con la cuenta seleccionada');
                                  })
                                }
                              >
                                <Copy size={14} />
                              </button>
                              <button type="button" title="Eliminar" className={`${iconBtn} hover:text-red-600`} onClick={() => void remove(a)}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data && data.count > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-xs text-gray-600">
              <span>
                {data.count} {data.count === 1 ? 'cuenta' : 'cuentas'} · página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold hover:bg-gray-50 disabled:opacity-40">
                  Anterior
                </button>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold hover:bg-gray-50 disabled:opacity-40">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewing && (
        <PaymentAccountViewer
          account={viewing}
          title={`Cuenta de cobro No. ${formatNumber(viewing.number)}`}
          onClose={() => setViewing(null)}
          onDownloadPdf={(withSignature) => downloadPaymentAccountPdf(viewing, { withSignature })}
          onDownloadWord={(withSignature) => downloadPaymentAccountDocx(viewing, { withSignature })}
        />
      )}
    </div>
  );
}
