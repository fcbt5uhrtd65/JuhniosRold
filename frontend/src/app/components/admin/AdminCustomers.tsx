import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { Users, TrendingUp, DollarSign, Plus, Search, ChevronDown, ChevronUp, X, FileText, FileDown, FileSpreadsheet, Loader2, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { getInvoiceByOrder, openInvoicePdf } from '../../services/payments.service';
import { exportCustomersPdf, exportCustomersExcel } from '../../services/customers.service';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import { LocationPicker } from '../ui/LocationPicker';
import { AddressMap } from '../ui/AddressMap';
import { EMPTY_LOCATION, type LocationValue } from '../../services/geography.types';
import { KpiCard, Card, Badge, type BadgeColor, Modal, Field, inputCls, selectCls } from './AdminUI';
import { Pagination } from './Pagination';
import type { Order, Customer } from '../../types/admin';

type CustomerFormData = {
  tipoDocumento: string;
  documento: string;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  modoCompra: 'RETAIL' | 'WHOLESALE';
};

function CustomerOrdersModal({ customer, orders, onClose }: {
  customer: Customer;
  orders: Order[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [numberFilter, setNumberFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);

  const handleViewInvoice = async (orderId: string) => {
    setLoadingInvoiceId(orderId);
    try {
      const invoice = await getInvoiceByOrder(orderId);
      if (!invoice) { toast.warning('No hay factura disponible para este pedido.'); return; }
      await openInvoicePdf(invoice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir la factura.');
    } finally {
      setLoadingInvoiceId(null);
    }
  };
  const perPage = 8;

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchNum = !numberFilter || (o.numero ?? o.id).toLowerCase().includes(numberFilter.toLowerCase());
      const matchStatus = !statusFilter || o.estado === statusFilter;
      const matchDate = !dateFilter || o.fecha.startsWith(dateFilter);
      return matchNum && matchStatus && matchDate;
    });
  }, [orders, numberFilter, statusFilter, dateFilter]);

  useEffect(() => { setPage(1); }, [numberFilter, statusFilter, dateFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const statusLabel: Record<Order['estado'], string> = {
    pendiente: 'Pendiente', confirmado: 'Confirmado', procesando: 'Procesando',
    empacado: 'Empacado', pagado: 'Pagado', enviado: 'Enviado',
    en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado',
    devuelto: 'Devuelto', fallido: 'Fallido',
  };

  const statusColor: Record<Order['estado'], BadgeColor> = {
    pendiente: 'yellow', confirmado: 'blue', procesando: 'blue', empacado: 'blue',
    pagado: 'purple', enviado: 'blue', en_camino: 'blue', entregado: 'green',
    cancelado: 'red', devuelto: 'red', fallido: 'red',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Pedidos de {customer.nombre}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{orders.length} pedido{orders.length !== 1 ? 's' : ''} en total</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={numberFilter}
              onChange={e => setNumberFilter(e.target.value)}
              placeholder="Número de pedido..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
          >
            <option value="">Todos los estados</option>
            {(Object.keys(statusLabel) as Order['estado'][]).map(s => (
              <option key={s} value={s}>{statusLabel[s]}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {paginated.map(order => (
            <div key={order.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 font-mono">#{order.numero ?? order.id.slice(0, 8)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{format(new Date(order.fecha), "dd/MM/yyyy 'a las' HH:mm")}</p>
              </div>
              <Badge label={statusLabel[order.estado]} color={statusColor[order.estado]} />
              <p className="text-sm font-bold text-gray-900">${order.total.toLocaleString()}</p>
              {!['pendiente','cancelado','devuelto','fallido'].includes(order.estado) && (
                <button
                  onClick={() => handleViewInvoice(order.id)}
                  disabled={loadingInvoiceId === order.id}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors disabled:opacity-40"
                  title="Ver factura"
                >
                  {loadingInvoiceId === order.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <FileText size={11} />}
                  Factura
                </button>
              )}
            </div>
          ))}
          {paginated.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No hay pedidos con esos filtros.</p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={perPage}
              itemsPerPageOptions={[8]}
              onPageChange={setPage}
              onItemsPerPageChange={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminCustomers() {
  const { customers, orders, addCustomer, updateCustomer, deleteCustomer } = useAdmin();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Customer | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<CustomerFormData | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [ordersModalCustomer, setOrdersModalCustomer] = useState<Customer | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  const handleViewInvoice = async (orderId: string) => {
    setLoadingInvoiceId(orderId);
    try {
      const invoice = await getInvoiceByOrder(orderId);
      if (!invoice) { toast.warning('No hay factura disponible para este pedido.'); return; }
      await openInvoicePdf(invoice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir la factura.');
    } finally {
      setLoadingInvoiceId(null);
    }
  };
  const [formData, setFormData] = useState<CustomerFormData>({
    tipoDocumento: 'CC',
    documento: '',
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    modoCompra: 'RETAIL',
  });
  const [customerLocation, setCustomerLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [editFormData, setEditFormData] = useState<CustomerFormData>({
    tipoDocumento: 'CC',
    documento: '',
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    modoCompra: 'RETAIL',
  });
  const [editCustomerLocation, setEditCustomerLocation] = useState<LocationValue>(EMPTY_LOCATION);

  const [nameFilter, setNameFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [docFilter, setDocFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportCity, setExportCity] = useState('');
  const [exportMinOrders, setExportMinOrders] = useState('');
  const [exportMaxOrders, setExportMaxOrders] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const normalizeText = (value: string | undefined | null) =>
    value?.toLowerCase().trim() ?? '';

  const filteredCustomers = useMemo(() => {
    const nameQ = normalizeText(nameFilter);
    const cityQ = normalizeText(cityFilter);
    const docQ = normalizeText(docFilter);

    return customers.filter((c) => {
      return (
        (!nameQ || normalizeText(c.nombre).includes(nameQ) || normalizeText(c.email).includes(nameQ) || normalizeText(c.telefono).includes(nameQ)) &&
        (!cityQ || normalizeText(c.ciudad).includes(cityQ)) &&
        (!docQ || normalizeText(c.documento).includes(docQ))
      );
    });
  }, [customers, nameFilter, cityFilter, docFilter]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => { setCurrentPage(1); }, [nameFilter, cityFilter, docFilter]);
  useEffect(() => {
    setCurrentPage(page => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  const clearFilters = () => {
    setNameFilter('');
    setCityFilter('');
    setDocFilter('');
  };

  const resetCreateForm = () => {
    setFormData({ tipoDocumento: 'CC', documento: '', nombre: '', telefono: '', email: '', direccion: '', ciudad: '', modoCompra: 'RETAIL' });
    setCustomerLocation(EMPTY_LOCATION);
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditFormData({
      tipoDocumento: customer.tipoDocumento || 'CC',
      documento: customer.documento || '',
      nombre: customer.nombre || '',
      telefono: customer.telefono || '',
      email: customer.email || '',
      direccion: customer.direccion || '',
      ciudad: customer.ciudad || '',
      modoCompra: customer.modoCompra ?? 'RETAIL',
    });
    setEditCustomerLocation({
      ...EMPTY_LOCATION,
      cityName: customer.ciudad || '',
      countryName: 'Colombia',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCustomer) return;
    setIsSubmittingCustomer(true);
    try {
      await addCustomer({ ...formData, ciudad: customerLocation.cityName || formData.ciudad });
      toast.success('Cliente creado correctamente');
      resetCreateForm();
      setShowModal(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible guardar el cliente. Revisa que el documento y el correo no estén repetidos.');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || isUpdatingCustomer) return;
    setPendingUpdate({
      ...editFormData,
      ciudad: editCustomerLocation.cityName || editFormData.ciudad,
    });
  };

  const confirmUpdateCustomer = async () => {
    if (!editingCustomer || !pendingUpdate || isUpdatingCustomer) return;
    setIsUpdatingCustomer(true);
    try {
      await updateCustomer(editingCustomer.id, pendingUpdate);
      toast.success('Cliente actualizado correctamente');
      setPendingUpdate(null);
      setEditingCustomer(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible actualizar el cliente.');
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  const confirmDeleteCustomer = async () => {
    if (!deleteCandidate || isDeletingCustomer) return;
    setIsDeletingCustomer(true);
    try {
      await deleteCustomer(deleteCandidate.id);
      toast.success('Cliente eliminado correctamente');
      if (expandedCustomerId === deleteCandidate.id) setExpandedCustomerId(null);
      if (ordersModalCustomer?.id === deleteCandidate.id) setOrdersModalCustomer(null);
      setDeleteCandidate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible eliminar el cliente.');
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const buildExportFilters = () => ({
    city: exportCity.trim() || undefined,
    minOrders: exportMinOrders.trim() ? Number(exportMinOrders) : undefined,
    maxOrders: exportMaxOrders.trim() ? Number(exportMaxOrders) : undefined,
  });

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportCustomersPdf(buildExportFilters());
      toast.success('PDF de clientes generado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el PDF de clientes');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportCustomersExcel(buildExportFilters());
      toast.success('Excel de clientes generado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el Excel de clientes');
    } finally {
      setExportingExcel(false);
    }
  };

  const stats = {
    total: customers.length,
    nuevos: customers.filter(c => {
      if (!c.ultimaCompra) return false;
      const daysSince = (Date.now() - new Date(c.ultimaCompra).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    }).length,
    ingresos: customers.reduce((sum, c) => sum + c.totalCompras, 0),
  };

  const getCustomerOrders = (customerId: string) =>
    orders.filter(o => o.clienteId === customerId && o.estado !== 'cancelado');

  const getModoColor = (modo?: string): BadgeColor =>
    modo === 'WHOLESALE' ? 'blue' : 'green';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Clientes</h2>
          <p className="text-xs text-gray-500 mt-0.5">{filteredCustomers.length} de {customers.length} clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportPanel(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#2a4038] text-[#2a4038] text-xs font-semibold rounded-xl hover:bg-[#eef4f1] transition-colors whitespace-nowrap"
          >
            <FileDown size={14} /> Exportar
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors whitespace-nowrap"
          >
            <Plus size={14} /> Nuevo Cliente
          </button>
        </div>
      </div>

      {showExportPanel && (
        <Card className="p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Exportar clientes</p>
            <button onClick={() => setShowExportPanel(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Ciudad</label>
              <input
                value={exportCity}
                onChange={e => setExportCity(e.target.value)}
                placeholder="Ej. Medellín"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Mínimo de pedidos</label>
              <input
                type="number"
                min={0}
                value={exportMinOrders}
                onChange={e => setExportMinOrders(e.target.value)}
                placeholder="Ej. 1"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Máximo de pedidos</label>
              <input
                type="number"
                min={0}
                value={exportMaxOrders}
                onChange={e => setExportMaxOrders(e.target.value)}
                placeholder="Ej. 10"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
            <button
              onClick={() => { setExportCity(''); setExportMinOrders(''); setExportMaxOrders(''); }}
              className="text-xs font-semibold text-gray-500 hover:text-[#2a4038] mr-auto"
            >
              Limpiar filtros de exportación
            </button>
            <button
              onClick={() => void handleExportExcel()}
              disabled={exportingExcel}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingExcel ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              {exportingExcel ? 'Generando...' : 'Exportar a Excel'}
            </button>
            <button
              onClick={() => void handleExportPdf()}
              disabled={exportingPdf}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              {exportingPdf ? 'Generando...' : 'Exportar a PDF'}
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total" value={String(stats.total)} icon={Users} color="text-[#2a4038] bg-[#2a4038]/10" />
        <KpiCard label="Nuevos (30d)" value={String(stats.nuevos)} icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Total Compras" value={`$${(stats.ingresos / 1000).toFixed(0)}k`} icon={DollarSign} color="text-blue-600 bg-blue-50" />
      </div>

      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Nombre / Contacto</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                placeholder="Nombre, correo o teléfono..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Documento</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={docFilter}
                onChange={e => setDocFilter(e.target.value)}
                placeholder="Número de documento..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Ciudad</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                placeholder="Ciudad del cliente..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>
        </div>
        {(nameFilter || cityFilter || docFilter) && (
          <div className="flex justify-end mt-3">
            <button onClick={clearFilters} className="text-xs font-semibold text-gray-500 hover:text-[#2a4038]">
              Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {paginatedCustomers.map((customer) => {
          const customerOrders = getCustomerOrders(customer.id);
          const isExpanded = expandedCustomerId === customer.id;

          return (
            <Card key={customer.id} className="p-0 overflow-hidden">
              <div className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1.15fr)_minmax(260px,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{customer.nombre}</p>
                    <Badge
                      label={customer.modoCompra === 'WHOLESALE' ? 'Mayorista' : 'Minorista'}
                      color={getModoColor(customer.modoCompra)}
                    />
                  </div>
                  {customer.modoCompra === 'WHOLESALE' && customer.companyName && (
                    <p className="text-xs font-medium text-gray-600 truncate">{customer.companyName}</p>
                  )}
                  <p className="text-xs text-gray-400">{customer.tipoDocumento} {customer.documento}</p>
                </div>

                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Contacto</p>
                    <p className="truncate text-xs font-medium text-gray-900">{customer.email}</p>
                    <p className="truncate text-xs text-gray-400">{customer.telefono}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ubicación</p>
                    <p className="truncate text-xs text-gray-700">{customer.ciudad || 'Sin ciudad'}</p>
                    <p className="truncate text-xs text-gray-400">{customer.direccion || 'Sin dirección'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                  <div className="text-left lg:text-right">
                    <p className="text-base font-bold text-gray-900">${customer.totalCompras.toLocaleString()}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">
                      {customerOrders.length} pedido{customerOrders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditCustomer(customer)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Pencil size={13} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteCandidate(customer)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-100 px-3 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                    Eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedCustomerId(cur => cur === customer.id ? null : customer.id)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Menos' : 'Ver más'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Documento</p>
                      <p className="text-xs text-gray-700">{customer.tipoDocumento} {customer.documento}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Ciudad</p>
                      <p className="text-xs text-gray-700">{customer.ciudad || '-'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dirección</p>
                      <p className="text-xs text-gray-700">{customer.direccion || '-'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Última compra</p>
                      <p className="text-xs text-gray-700">
                        {customer.ultimaCompra ? format(new Date(customer.ultimaCompra), 'dd/MM/yyyy') : '-'}
                      </p>
                    </div>
                  </div>

                  {customerOrders.length > 0 && (() => {
                    const latest = [...customerOrders].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
                    return (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                          Último pedido
                        </p>
                        <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                          <span className="text-gray-700 font-mono font-medium">#{latest.numero ?? latest.id.slice(0, 8)}</span>
                          <span className="text-gray-400">{format(new Date(latest.fecha), 'dd/MM/yyyy')}</span>
                          <span className="font-semibold text-gray-900">${latest.total.toLocaleString()}</span>
                          {!['pendiente', 'cancelado', 'devuelto', 'fallido'].includes(latest.estado) && (
                            <button
                              onClick={() => handleViewInvoice(latest.id)}
                              disabled={loadingInvoiceId === latest.id}
                              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors disabled:opacity-40"
                              title="Ver factura"
                            >
                              {loadingInvoiceId === latest.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <FileText size={11} />}
                              Factura
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setOrdersModalCustomer(customer)}
                          className="mt-2 w-full text-center text-[11px] font-semibold text-[#2a4038] hover:underline"
                        >
                          Ver todos los pedidos ({customerOrders.length})
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </Card>
          );
        })}

        {paginatedCustomers.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm font-medium text-gray-700">No hay clientes con esos filtros.</p>
            <p className="text-xs text-gray-400 mt-1">Prueba con otro nombre, documento o ciudad.</p>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCustomers.length}
          itemsPerPage={itemsPerPage}
          itemsPerPageOptions={[10, 25, 50]}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={count => { setItemsPerPage(count); setCurrentPage(1); }}
        />
      </div>

      <Modal title="Nuevo Cliente" open={showModal} onClose={() => setShowModal(false)} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Tipo de Documento" required>
              <select
                value={formData.tipoDocumento}
                onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                className={selectCls}
                required
              >
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="PASSPORT">Pasaporte</option>
                <option value="NIT">NIT</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>

            <Field label="Número de Documento" required>
              <input
                type="text"
                value={formData.documento}
                onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Nombre Completo" required>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Teléfono" required>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="¿Cómo deseas comprar?">
              <select
                value={formData.modoCompra}
                onChange={(e) => setFormData({ ...formData, modoCompra: e.target.value as 'RETAIL' | 'WHOLESALE' })}
                className={selectCls}
              >
                <option value="RETAIL">Compra personal / minorista</option>
                <option value="WHOLESALE">Compra mayorista</option>
              </select>
            </Field>

            <div className="sm:col-span-2">
              <LocationPicker
                value={customerLocation}
                onChange={setCustomerLocation}
              />
            </div>
          </div>

          <Field label="Dirección" required>
            <input
              type="text"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              className={inputCls}
              required
            />
          </Field>

          {(formData.direccion || customerLocation.cityName) && (
            <AddressMap
              address={formData.direccion}
              city={customerLocation.cityName}
              country={customerLocation.countryName || 'Colombia'}
              className="h-56 rounded-xl border border-gray-200"
            />
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmittingCustomer}
              className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingCustomer ? 'Creando...' : 'Crear Cliente'}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={`Editar Cliente${editingCustomer ? `: ${editingCustomer.nombre}` : ''}`}
        open={!!editingCustomer}
        onClose={() => {
          if (isUpdatingCustomer) return;
          setEditingCustomer(null);
          setPendingUpdate(null);
        }}
        wide
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Tipo de Documento" required>
              <select
                value={editFormData.tipoDocumento}
                onChange={(e) => setEditFormData({ ...editFormData, tipoDocumento: e.target.value })}
                className={selectCls}
                required
              >
                <option value="CC">CÃ©dula de CiudadanÃ­a</option>
                <option value="CE">CÃ©dula de ExtranjerÃ­a</option>
                <option value="PASSPORT">Pasaporte</option>
                <option value="NIT">NIT</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>

            <Field label="NÃºmero de Documento" required>
              <input
                type="text"
                value={editFormData.documento}
                onChange={(e) => setEditFormData({ ...editFormData, documento: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Nombre Completo" required>
              <input
                type="text"
                value={editFormData.nombre}
                onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="TelÃ©fono" required>
              <input
                type="tel"
                value={editFormData.telefono}
                onChange={(e) => setEditFormData({ ...editFormData, telefono: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Â¿CÃ³mo deseas comprar?">
              <select
                value={editFormData.modoCompra}
                onChange={(e) => setEditFormData({ ...editFormData, modoCompra: e.target.value as 'RETAIL' | 'WHOLESALE' })}
                className={selectCls}
              >
                <option value="RETAIL">Compra personal / minorista</option>
                <option value="WHOLESALE">Compra mayorista</option>
              </select>
            </Field>

            <div className="sm:col-span-2">
              <LocationPicker
                value={editCustomerLocation}
                onChange={setEditCustomerLocation}
              />
            </div>
          </div>

          <Field label="DirecciÃ³n" required>
            <input
              type="text"
              value={editFormData.direccion}
              onChange={(e) => setEditFormData({ ...editFormData, direccion: e.target.value })}
              className={inputCls}
              required
            />
          </Field>

          {(editFormData.direccion || editCustomerLocation.cityName) && (
            <AddressMap
              address={editFormData.direccion}
              city={editCustomerLocation.cityName || editFormData.ciudad}
              country={editCustomerLocation.countryName || 'Colombia'}
              className="h-56 rounded-xl border border-gray-200"
            />
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isUpdatingCustomer}
              className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingCustomer ? 'Actualizando...' : 'Actualizar Cliente'}
            </button>
            <button
              type="button"
              disabled={isUpdatingCustomer}
              onClick={() => {
                setEditingCustomer(null);
                setPendingUpdate(null);
              }}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Confirmar actualizaciÃ³n" open={!!pendingUpdate} onClose={() => !isUpdatingCustomer && setPendingUpdate(null)}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Â¿Deseas guardar los cambios de este cliente?</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                El sistema actualizarÃ¡ los datos de contacto, documento, direcciÃ³n y modo de compra.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={confirmUpdateCustomer}
              disabled={isUpdatingCustomer}
              className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
            >
              {isUpdatingCustomer ? 'Guardando...' : 'SÃ­, actualizar'}
            </button>
            <button
              type="button"
              onClick={() => setPendingUpdate(null)}
              disabled={isUpdatingCustomer}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Revisar de nuevo
            </button>
          </div>
        </div>
      </Modal>

      <Modal title="Eliminar cliente" open={!!deleteCandidate} onClose={() => !isDeletingCustomer && setDeleteCandidate(null)}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Â¿Seguro que deseas eliminar este cliente?</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {deleteCandidate?.nombre} dejarÃ¡ de aparecer en el panel de clientes. Esta acciÃ³n requiere permisos de ediciÃ³n.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={confirmDeleteCustomer}
              disabled={isDeletingCustomer}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isDeletingCustomer ? 'Eliminando...' : 'SÃ­, eliminar'}
            </button>
            <button
              type="button"
              onClick={() => setDeleteCandidate(null)}
              disabled={isDeletingCustomer}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {ordersModalCustomer && (
        <CustomerOrdersModal
          customer={ordersModalCustomer}
          orders={orders.filter(o => o.clienteId === ordersModalCustomer.id)}
          onClose={() => setOrdersModalCustomer(null)}
        />
      )}
    </div>
  );
}
