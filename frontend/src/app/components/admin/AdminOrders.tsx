import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  Package,
  Clock,
  Check,
  X,
  Truck,
  MapPin,
  ChevronDown,
  ChevronUp,
  LayoutList,
  Maximize2,
  Search,
  Calendar,
  Hash,
  FileText,
  Loader2,
  DollarSign,
  ExternalLink,
  Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Order } from '../../types/admin';
import { AdminRegistrarGuia } from './AdminRegistrarGuia';
import { KpiCard, Card, Badge, type BadgeColor } from './AdminUI';
import { InteractiveLocationMap } from '../ui/InteractiveLocationMap';
import { Pagination } from './Pagination';
import { getTrackingPedido, type TrackingPedido } from '../../services/enviosApi';
import { getInvoiceByOrder, openInvoicePdf } from '../../services/payments.service';
import { useToast } from '../../contexts/ToastContext';

const noop = () => {};

// Workflow states visible to the admin, in order.
const WORKFLOW: Order['estado'][] = ['pagado', 'procesando', 'empacado', 'enviado', 'entregado'];

// The only allowed next state for each workflow state.
const NEXT_STATE: Partial<Record<Order['estado'], Order['estado']>> = {
  pagado: 'procesando',
  procesando: 'empacado',
  empacado: 'enviado',
  enviado: 'entregado',
};

const STATUS_LABEL: Partial<Record<Order['estado'], string>> = {
  pagado: 'Pagado',
  procesando: 'Procesando',
  empacado: 'Empacado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  pendiente: 'Pendiente',
  fallido: 'Fallido',
  cancelado: 'Cancelado',
  devuelto: 'Devuelto',
  confirmado: 'Confirmado',
  en_camino: 'En camino',
};

const STATUS_LABEL_EN: Record<string, string> = {
  pending: 'Pendiente',
  payment_pending: 'Pago pendiente',
  confirmed: 'Confirmado',
  paid: 'Pagado',
  processing: 'Procesando',
  packed: 'Empacado',
  shipped: 'Enviado',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  returned: 'Devuelto',
  failed: 'Fallido',
  pendiente: 'Pendiente',
  guia_generada: 'Guía generada',
  generando_guia: 'Generando guía',
  recogida_programada: 'Recogida programada',
  recogido: 'Recogido',
  en_transito: 'En tránsito',
  en_reparto: 'En reparto',
  entregado: 'Entregado',
  novedad: 'Novedad',
  devuelto: 'Devuelto',
};

function translateStatus(status: string): string {
  const key = status.toLowerCase();
  return STATUS_LABEL[key as keyof typeof STATUS_LABEL]
    ?? STATUS_LABEL_EN[key]
    ?? status;
}

function isWorkflowState(estado: Order['estado']): boolean {
  return WORKFLOW.includes(estado);
}

export function AdminOrders() {
  const { orders, customers, updateOrderStatus } = useAdmin();
  const toast = useToast();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [orderNumberFilter, setOrderNumberFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<Order['estado'] | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [trackingData, setTrackingData] = useState<Record<string, TrackingPedido>>({});
  const [loadingTrackingId, setLoadingTrackingId] = useState<string | null>(null);
  const [showTrackingId, setShowTrackingId] = useState<string | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [expandedShippingId, setExpandedShippingId] = useState<string | null>(null);
  // Which order is showing the "Registrar guía" modal
  const [guiaOrderId, setGuiaOrderId] = useState<string | null>(null);

  const loadTracking = async (orderId: string, force = false) => {
    if (!force && trackingData[orderId]) return;
    setLoadingTrackingId(orderId);
    try {
      const data = await getTrackingPedido(orderId);
      setTrackingData(prev => ({ ...prev, [orderId]: data }));
    } catch {
      // silencioso — el componente de tracking maneja su propio error
    } finally {
      setLoadingTrackingId(null);
    }
  };

  const handleViewInvoice = async (orderId: string) => {
    setLoadingInvoiceId(orderId);
    try {
      const invoice = await getInvoiceByOrder(orderId);
      if (!invoice) { toast.warning('No hay factura para este pedido.'); return; }
      await openInvoicePdf(invoice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir la factura.');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const normalizeText = (value: string | undefined | null) => value?.toLowerCase().trim() ?? '';

  const filteredOrders = useMemo(() => {
    const cityQuery = normalizeText(cityFilter);
    const customerQuery = normalizeText(customerFilter);
    const orderQuery = normalizeText(orderNumberFilter);
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return orders.filter((order) => {
      const customer = customers.find(c => c.id === order.clienteId);
      const cityText = normalizeText(`${order.ciudadEnvio ?? ''} ${customer?.ciudad ?? ''}`);
      const customerText = normalizeText(`${customer?.nombre ?? ''} ${customer?.email ?? ''} ${customer?.telefono ?? ''}`);
      const orderText = normalizeText(`${order.numero ?? ''} ${order.id}`);
      const orderDate = new Date(order.fecha);

      return (!cityQuery || cityText.includes(cityQuery)) &&
        (!customerQuery || customerText.includes(customerQuery)) &&
        (!orderQuery || orderText.includes(orderQuery)) &&
        (!statusFilter || order.estado === statusFilter) &&
        (!fromDate || orderDate >= fromDate) &&
        (!toDate || orderDate <= toDate);
    });
  }, [orders, customers, cityFilter, customerFilter, orderNumberFilter, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [cityFilter, customerFilter, orderNumberFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  const clearFilters = () => {
    setCityFilter('');
    setCustomerFilter('');
    setOrderNumberFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const getStatusIcon = (estado: Order['estado']) => {
    switch (estado) {
      case 'pendiente':
        return <Clock size={13} />;
      case 'pagado':
        return <Check size={13} />;
      case 'confirmado':
      case 'procesando':
      case 'empacado':
        return <Package size={13} />;
      case 'enviado':
      case 'en_camino':
        return <Truck size={13} />;
      case 'entregado':
        return <Package size={13} />;
      case 'cancelado':
      case 'devuelto':
      case 'fallido':
        return <X size={13} />;
    }
  };

  const getStatusColor = (estado: Order['estado']): BadgeColor => {
    switch (estado) {
      case 'pendiente':
        return 'yellow';
      case 'pagado':
        return 'purple';
      case 'confirmado':
      case 'procesando':
      case 'empacado':
        return 'blue';
      case 'enviado':
      case 'en_camino':
        return 'blue';
      case 'entregado':
        return 'green';
      case 'cancelado':
      case 'devuelto':
      case 'fallido':
        return 'red';
    }
  };

  const stats = {
    porProcesar: orders.filter(o => o.estado === 'pagado' || o.estado === 'procesando' || o.estado === 'empacado').length,
    enviados: orders.filter(o => o.estado === 'enviado' || o.estado === 'en_camino').length,
    entregados: orders.filter(o => o.estado === 'entregado').length,
    total: orders.reduce((sum, o) => o.estado !== 'cancelado' ? sum + o.total : sum, 0),
  };

  const handleStatusClick = (order: Order, targetStatus: Order['estado']) => {
    if (targetStatus === 'enviado') {
      // Open the "Registrar guía" form instead of directly updating status
      setGuiaOrderId(order.id);
      return;
    }
    void updateOrderStatus(order.id, targetStatus);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pedidos</h2>
          <p className="text-xs text-gray-500 mt-0.5">{filteredOrders.length} de {orders.length} pedidos</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAllDetails(value => !value);
            setExpandedOrderId(null);
          }}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:self-center"
        >
          {showAllDetails ? <LayoutList size={14} /> : <Maximize2 size={14} />}
          {showAllDetails ? 'Vista compacta' : 'Vista detallada'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Por procesar" value={String(stats.porProcesar)} icon={Clock} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Enviados" value={String(stats.enviados)} icon={Truck} color="text-blue-600 bg-blue-50" />
        <KpiCard label="Entregados" value={String(stats.entregados)} icon={Package} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Ingresos" value={`$${(stats.total / 1000).toFixed(0)}k`} icon={Check} color="text-[#2a4038] bg-[#2a4038]/10" />
      </div>

      <Card className="p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
          {/* Número de pedido */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Número de pedido</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={orderNumberFilter}
                onChange={e => setOrderNumberFilter(e.target.value)}
                placeholder="ID o número..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Cliente */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cliente</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
                placeholder="Nombre, correo o teléfono..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Ciudad */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ciudad</label>
            <div className="relative">
              <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                placeholder="Ciudad de envío o cliente..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Estado */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Estado</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as Order['estado'] | '')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] text-gray-700"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="procesando">Procesando</option>
              <option value="empacado">Empacado</option>
              <option value="enviado">Enviado</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Fecha desde */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fecha desde</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>

          {/* Fecha hasta */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fecha hasta</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={e => setDateTo(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>
        </div>

        {(cityFilter || customerFilter || orderNumberFilter || statusFilter || dateFrom || dateTo) && (
          <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-gray-400 hover:text-[#2a4038] transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {paginatedOrders.map((order) => {
          const customer = customers.find(c => c.id === order.clienteId);
          const destination = [order.ciudadEnvio, order.departamentoEnvio, order.paisEnvio].filter(Boolean).join(', ');
          const canShowShipping = Boolean(order.direccionEnvio || (order.latitudEnvio && order.longitudEnvio));
          const isExpanded = showAllDetails || expandedOrderId === order.id;
          const inWorkflow = isWorkflowState(order.estado);
          const currentIndex = WORKFLOW.indexOf(order.estado);
          const nextState = NEXT_STATE[order.estado];
          const td = trackingData[order.id];
          const envio = td?.envio;

          return (
            <Card key={order.id} className="p-0 overflow-hidden">
              <div className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1.15fr)_minmax(260px,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">Pedido #{order.numero ?? order.id}</p>
                    <Badge
                      label={
                        <span className="flex items-center gap-1 capitalize">
                          {getStatusIcon(order.estado)}
                          {STATUS_LABEL[order.estado] ?? order.estado}
                        </span>
                      }
                      color={getStatusColor(order.estado)}
                    />
                  </div>
                  <p className="text-xs text-gray-400">{format(new Date(order.fecha), "dd/MM/yyyy 'a las' HH:mm")}</p>
                </div>

                <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cliente</p>
                    <p className="truncate text-xs font-medium text-gray-900">{customer?.nombre || 'Cliente'}</p>
                    <p className="truncate text-xs text-gray-400">{customer?.email || customer?.ciudad || 'Sin correo'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Envio</p>
                    <p className="truncate text-xs text-gray-700">{order.direccionEnvio || 'Sin direccion registrada'}</p>
                    <p className="truncate text-xs text-gray-400">{destination || customer?.ciudad || 'Sin ciudad'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <div className="text-left lg:text-right">
                    <p className="text-base font-bold text-gray-900">${order.total.toLocaleString()}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">
                      {order.metodoPago || `${order.productos.length} productos`}
                    </p>
                  </div>
                  {!showAllDetails && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = expandedOrderId === order.id ? null : order.id;
                        setExpandedOrderId(next);
                        if (next) void loadTracking(next);
                      }}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Menos' : 'Ver mas'}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-4">

                  {/* Resumen cliente / dirección / pago */}
                  <div className="grid gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cliente</p>
                      <p className="truncate text-xs font-medium text-gray-900">{customer?.nombre || 'Cliente'}</p>
                      <p className="truncate text-xs text-gray-500">{customer?.email || 'Sin correo'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Dirección</p>
                      <p className="truncate text-xs text-gray-700">{order.direccionEnvio || 'Sin dirección'}</p>
                      <p className="truncate text-xs text-gray-500">{destination || customer?.ciudad || 'Sin ciudad'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pago</p>
                      <p className="text-xs font-medium text-gray-900">${order.total.toLocaleString()}</p>
                      <p className="truncate text-xs uppercase text-gray-500">{order.metodoPago || 'Sin método'}</p>
                    </div>
                  </div>

                  {/* Info de guía / envío */}
                  {loadingTrackingId === order.id && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 size={12} className="animate-spin" /> Cargando info de envío…
                    </div>
                  )}
                  {envio && (
                    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                      {/* Resumen siempre visible */}
                      <div className="flex items-center justify-between gap-3 p-3">
                        <div className="grid gap-2 sm:grid-cols-3 text-xs flex-1">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400">Transportadora</p>
                            <p className="font-medium text-gray-800">{envio.transportadora?.nombre ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1">
                              <Hash size={9} /> Guía
                            </p>
                            <p className="font-mono font-semibold text-gray-800">{envio.numero_guia || 'Sin asignar'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1">
                              <Calendar size={9} /> Entrega estimada
                            </p>
                            <p className="font-medium text-gray-800">
                              {envio.fecha_entrega_estimada
                                ? new Date(envio.fecha_entrega_estimada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Por confirmar'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedShippingId(prev => prev === order.id ? null : order.id)}
                          className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#2a4038] hover:underline"
                        >
                          {expandedShippingId === order.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {expandedShippingId === order.id ? 'Ocultar' : 'Ver detalle'}
                        </button>
                      </div>

                      {/* Panel detallado */}
                      {expandedShippingId === order.id && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                          {/* Fila 1: estado + costo + despacho + entrega real */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-0.5">
                                <Tag size={9} /> Estado envío
                              </p>
                              <span className="inline-block rounded-full bg-[#2a4038]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2a4038]">
                                {envio.estado_envio ?? '—'}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-0.5">
                                <DollarSign size={9} /> Costo de envío
                              </p>
                              <p className="font-medium text-gray-800">
                                {envio.costo_envio ? `$${Number(envio.costo_envio).toLocaleString('es-CO')}` : 'No registrado'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-0.5">
                                <Calendar size={9} /> Fecha despacho
                              </p>
                              <p className="font-medium text-gray-800">
                                {envio.fecha_despacho
                                  ? new Date(envio.fecha_despacho).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : 'Pendiente'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-0.5">
                                <Check size={9} /> Entrega real
                              </p>
                              <p className="font-medium text-gray-800">
                                {envio.fecha_entrega_real
                                  ? new Date(envio.fecha_entrega_real).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : 'Pendiente'}
                              </p>
                            </div>
                          </div>

                          {/* Dirección */}
                          <div className="text-xs">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-0.5">
                              <MapPin size={9} /> Dirección de entrega
                            </p>
                            <p className="text-gray-700">
                              {[envio.direccion_envio, envio.ciudad, envio.departamento, envio.pais].filter(Boolean).join(', ') || 'No registrada'}
                            </p>
                          </div>

                          {/* URL de rastreo */}
                          {envio.tracking_url && (
                            <div className="text-xs">
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">URL de rastreo</p>
                              <a
                                href={envio.tracking_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#2a4038] underline underline-offset-2"
                              >
                                <ExternalLink size={11} /> {envio.tracking_url}
                              </a>
                            </div>
                          )}

                          {/* Historial de eventos */}
                          {envio.eventos && envio.eventos.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Historial de eventos</p>
                              <div className="space-y-2">
                                {envio.eventos.map(evento => (
                                  <div key={evento.id} className="flex gap-3 text-xs">
                                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#2a4038]" />
                                    <div>
                                      <p className="font-semibold text-gray-800">{evento.estado}</p>
                                      {evento.descripcion && <p className="text-gray-500">{evento.descripcion}</p>}
                                      {evento.ubicacion && <p className="text-gray-400">{evento.ubicacion}</p>}
                                      <p className="text-[10px] text-gray-400 mt-0.5">
                                        {new Date(evento.fecha_evento).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                    <div className="space-y-4">
                      {/* Productos */}
                      <div>
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Productos ({order.productos.length})
                        </p>
                        <div className="space-y-2">
                          {order.productos.map((item, index) => (
                            <div key={index} className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 text-[10px] text-gray-500">
                                  {item.cantidad}x
                                </span>
                                <span className="truncate text-gray-700">{item.nombre}</span>
                              </div>
                              <span className="shrink-0 font-medium text-gray-900">${(item.precio * item.cantidad).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Flujo de estados */}
                      {inWorkflow && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Flujo de pedido</p>
                          <div className="flex flex-wrap gap-2">
                            {WORKFLOW.map((step, index) => {
                              const isCompleted = index < currentIndex;
                              const isCurrent = step === order.estado;
                              const isNext = nextState === step;
                              const isDisabled = !isCompleted && !isCurrent && !isNext;

                              return (
                                <button
                                  key={step}
                                  disabled={isDisabled || isCurrent || isCompleted}
                                  onClick={() => handleStatusClick(order, step)}
                                  className={`h-9 rounded-lg px-3 text-[11px] font-semibold transition-colors ${
                                    isCurrent
                                      ? 'bg-[#2a4038] text-white cursor-default'
                                      : isCompleted
                                        ? 'bg-gray-100 text-gray-400 cursor-default line-through'
                                        : isNext
                                          ? 'border border-[#2a4038] text-[#2a4038] hover:bg-[#2a4038]/5'
                                          : 'border border-gray-200 text-gray-300 cursor-not-allowed'
                                  }`}
                                >
                                  {isCompleted && <span className="mr-1">✓</span>}
                                  {STATUS_LABEL[step]}
                                </button>
                              );
                            })}
                          </div>

                          {/* Modal de guía: aparece al hacer clic en "Enviado" */}
                          {guiaOrderId === order.id && (
                            <AdminRegistrarGuia
                              pedidoId={order.id}
                              onSaved={() => {
                                setGuiaOrderId(null);
                                void updateOrderStatus(order.id, 'enviado');
                                void loadTracking(order.id, true);
                              }}
                              onCancel={() => setGuiaOrderId(null)}
                            />
                          )}
                        </div>
                      )}

                      {/* Estado interno (Pendiente, Fallido, Cancelado, etc.) — solo lectura */}
                      {!inWorkflow && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Estado</p>
                          <Badge
                            label={
                              <span className="flex items-center gap-1">
                                {getStatusIcon(order.estado)}
                                {STATUS_LABEL[order.estado] ?? order.estado}
                              </span>
                            }
                            color={getStatusColor(order.estado)}
                          />
                        </div>
                      )}

                      {/* Ver factura */}
                      {!['pendiente', 'cancelado', 'fallido'].includes(order.estado) && (
                        <div>
                          <button
                            onClick={() => handleViewInvoice(order.id)}
                            disabled={loadingInvoiceId === order.id}
                            className="inline-flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                          >
                            {loadingInvoiceId === order.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <FileText size={14} />}
                            Ver factura
                          </button>
                        </div>
                      )}

                    </div>

                    {/* Mapa */}
                    {canShowShipping && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          <MapPin size={12} /> Mapa de entrega
                        </p>
                        {order.latitudEnvio != null && order.longitudEnvio != null ? (
                          <InteractiveLocationMap
                            lat={order.latitudEnvio}
                            lng={order.longitudEnvio}
                            onMarkerMove={noop}
                            readOnly
                            className="h-48 overflow-hidden rounded-lg border border-gray-200 xl:h-full xl:min-h-56"
                          />
                        ) : (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                            {order.direccionEnvio}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Historial de actividad */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowTrackingId(cur => cur === order.id ? null : order.id)}
                      className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#2a4038] hover:underline"
                    >
                      <FileText size={12} />
                      {showTrackingId === order.id ? 'Ocultar historial' : 'Ver historial de actividad'}
                    </button>
                    {showTrackingId === order.id && (() => {
                      const historialPedido = td?.historial_pedido ?? [];
                      const eventosEnvio = td?.envio?.eventos ?? [];

                      type ActivityEntry = { fecha: string; titulo: string; detalle?: string; autor?: string };
                      const entries: ActivityEntry[] = [
                        ...historialPedido.map(h => ({
                          fecha: h.created_at,
                          titulo: translateStatus(h.status),
                          detalle: h.notes || undefined,
                          autor: h.changed_by_email,
                        })),
                        ...eventosEnvio.map(e => ({
                          fecha: e.fecha_evento,
                          titulo: translateStatus(e.estado.toLowerCase()),
                          detalle: [e.descripcion, e.ubicacion].filter(Boolean).join(' · ') || undefined,
                          autor: e.changed_by_email,
                        })),
                      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

                      return (
                        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                          {loadingTrackingId === order.id ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Loader2 size={12} className="animate-spin" /> Cargando historial…
                            </div>
                          ) : entries.length === 0 ? (
                            <p className="text-xs text-gray-400">Sin actividad registrada.</p>
                          ) : (
                            <div className="space-y-0">
                              {entries.map((entry, i) => (
                                <div key={i} className="flex gap-3">
                                  <div className="flex flex-col items-center">
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2a4038]" />
                                    {i < entries.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                                  </div>
                                  <div className="pb-4 min-w-0">
                                    <p className="text-xs font-semibold text-gray-800">{entry.titulo}</p>
                                    {entry.detalle && <p className="text-[11px] text-gray-500 mt-0.5">{entry.detalle}</p>}
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                      {new Date(entry.fecha).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      {entry.autor && <span className="ml-2">· {entry.autor}</span>}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {paginatedOrders.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm font-medium text-gray-700">No hay pedidos con esos filtros.</p>
            <p className="text-xs text-gray-400 mt-1">Prueba con otro cliente, ciudad o número de pedido.</p>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredOrders.length}
          itemsPerPage={itemsPerPage}
          itemsPerPageOptions={[5, 10, 20]}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={count => { setItemsPerPage(count); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
}
