import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { Users, TrendingUp, DollarSign, Plus, Search, ChevronDown, ChevronUp, X, FileText, Loader2 } from 'lucide-react';
import { getInvoiceByOrder, openInvoicePdf } from '../../services/payments.service';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import { LocationPicker } from '../ui/LocationPicker';
import { AddressMap } from '../ui/AddressMap';
import { EMPTY_LOCATION, type LocationValue } from '../../services/geography.types';
import { KpiCard, Card, Badge, type BadgeColor, Modal, Field, inputCls, selectCls } from './AdminUI';
import { Pagination } from './Pagination';
import type { Order, Customer } from '../../types/admin';

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
  const { customers, orders, addCustomer } = useAdmin();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [ordersModalCustomer, setOrdersModalCustomer] = useState<Customer | null>(null);
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
  const [formData, setFormData] = useState<{
    tipoDocumento: string;
    documento: string;
    nombre: string;
    telefono: string;
    email: string;
    direccion: string;
    ciudad: string;
    modoCompra: 'RETAIL' | 'WHOLESALE';
  }>({
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

  const [nameFilter, setNameFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [docFilter, setDocFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addCustomer({ ...formData, ciudad: customerLocation.cityName || formData.ciudad });
    setFormData({ tipoDocumento: 'CC', documento: '', nombre: '', telefono: '', email: '', direccion: '', ciudad: '', modoCompra: 'RETAIL' });
    setCustomerLocation(EMPTY_LOCATION);
    setShowModal(false);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Clientes</h2>
          <p className="text-xs text-gray-500 mt-0.5">{filteredCustomers.length} de {customers.length} clientes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors"
        >
          <Plus size={14} /> Nuevo Cliente
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
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

                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <div className="text-left lg:text-right">
                    <p className="text-base font-bold text-gray-900">${customer.totalCompras.toLocaleString()}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">
                      {customerOrders.length} pedido{customerOrders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
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
              className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors"
            >
              Crear Cliente
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
