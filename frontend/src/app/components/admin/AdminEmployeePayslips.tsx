import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, Wallet, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  getMyPayslipDocuments,
  openPayslipDocumentPdf,
  type PayslipDocument,
} from '../../services/human-resources.service';
import { Badge, EmptyState, LoadingState, selectCls } from './AdminUI';
import { Pagination } from './Pagination';
import { SearchBar } from './SearchBar';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha registrada';
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-CO');
  }
  return new Date(value).toLocaleDateString('es-CO');
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function AdminEmployeePayslips() {
  const toast = useToast();
  const [payslips, setPayslips] = useState<PayslipDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingPayslipId, setDownloadingPayslipId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadPayslips = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getMyPayslipDocuments({ limit: 200 });
      setPayslips(response.data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar tus volantes de pago');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadPayslips();
  }, [loadPayslips]);

  const handleDownload = async (payslip: PayslipDocument) => {
    setDownloadingPayslipId(payslip.id);
    try {
      await openPayslipDocumentPdf(payslip.id, payslip.file_name || `${payslip.title}.pdf`);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo descargar el volante de pago');
    } finally {
      setDownloadingPayslipId(null);
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set(payslips.map((payslip) => payslip.period_end?.slice(0, 4)).filter(Boolean) as string[]);
    return [...years].sort((left, right) => right.localeCompare(left));
  }, [payslips]);

  const filteredPayslips = useMemo(() => {
    const query = normalizeSearchText(search);
    return payslips
      .filter((payslip) => yearFilter === 'all' || payslip.period_end?.slice(0, 4) === yearFilter)
      .filter((payslip) => {
        if (!query) return true;
        return (
          normalizeSearchText(payslip.title).includes(query) ||
          normalizeSearchText(payslip.notes ?? '').includes(query)
        );
      })
      .sort((left, right) => (right.period_end ?? '').localeCompare(left.period_end ?? ''));
  }, [payslips, search, yearFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, yearFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPayslips.length / pageSize));
  const paginatedPayslips = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPayslips.slice(start, start + pageSize);
  }, [filteredPayslips, page, pageSize]);

  const hasActiveFilters = Boolean(search.trim()) || yearFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setYearFilter('all');
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Volante de pago</h2>
          <p className="text-xs text-gray-500 mt-0.5">Consulta y descarga tu historial de volantes de pago publicados por RRHH.</p>
        </div>
        {payslips.length > 0 && <Badge label={`${payslips.length} en total`} color="green" />}
      </div>

      {isLoading ? (
        <LoadingState label="Cargando volantes de pago..." />
      ) : payslips.length === 0 ? (
        <EmptyState title="Aún no tienes volantes de pago publicados." description="RRHH publicará aquí tus volantes de pago apenas estén disponibles." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5 bg-white border border-gray-100 rounded-2xl shadow-sm p-3">
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre o nota..." className="flex-1" />
            <div className="flex items-center gap-2">
              <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className={`${selectCls} w-auto min-w-[120px]`}>
                <option value="all">Todos los años</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors flex-shrink-0"
                >
                  <X size={13} />
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            <History size={13} className="text-gray-400" />
            <p className="text-xs text-gray-500">
              <span className="text-gray-900 font-semibold">{filteredPayslips.length}</span> {filteredPayslips.length === 1 ? 'volante encontrado' : 'volantes encontrados'}
            </p>
          </div>

          {filteredPayslips.length === 0 ? (
            <EmptyState title="Ningún volante coincide con tu búsqueda." description="Ajusta el texto o el año seleccionado." />
          ) : (
            <div className="space-y-3">
              {paginatedPayslips.map((payslip) => (
                <div key={payslip.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#2a4038]/10 text-[#2a4038] flex items-center justify-center flex-shrink-0">
                        <Wallet size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{payslip.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(payslip.period_start)} - {formatDate(payslip.period_end)}
                        </p>
                        <p className="text-xs text-gray-400">Pago: {formatDate(payslip.payment_date)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDownload(payslip)}
                      disabled={downloadingPayslipId === payslip.id}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <Download size={14} />
                      {downloadingPayslipId === payslip.id ? 'Descargando...' : 'Descargar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredPayslips.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredPayslips.length}
              itemsPerPage={pageSize}
              itemsPerPageOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onItemsPerPageChange={setPageSize}
            />
          )}
        </div>
      )}
    </div>
  );
}
