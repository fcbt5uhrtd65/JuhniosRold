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
} from 'lucide-react';
import { format } from 'date-fns';
import type { Order } from '../../types/admin';
import { AdminRegistrarGuia } from './AdminRegistrarGuia';
import { KpiCard, Card, Badge, type BadgeColor } from './AdminUI';
import { InteractiveLocationMap } from '../ui/InteractiveLocationMap';
import { Pagination } from './Pagination';

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

function isWorkflowState(estado: Order['estado']): boolean {
  return WORKFLOW.includes(estado);
}

export function AdminOrders() {
  const { orders, customers, updateOrderStatus, refreshData } = useAdmin();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [orderNumberFilter, setOrderNumberFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  // Track which order is showing the "Registrar guía" modal
  const [guiaOrderId, setGuiaOrderId] = useState<string | null>(null);

  const normalizeText = (value: string | undefined | null) => value?.toLowerCase().trim() ?? '';

  const filteredOrders = useMemo(() => {
    const cityQuery = normalizeText(cityFilter);
    const customerQuery = normalizeText(customerFilter);
    const orderQuery = normalizeText(orderNumberFilter);

    return orders.filter((order) => {
      const customer = customers.find(c => c.id === order.clienteId);
      const cityText = normalizeText(`${order.ciudadEnvio ?? ''} ${customer?.ciudad ?? ''}`);
      const customerText = normalizeText(`${customer?.nombre ?? ''} ${customer?.email ?? ''} ${customer?.telefono ?? ''}`);
      const orderText = normalizeText(`${order.numero ?? ''} ${order.id}`);

      return (!cityQuery || cityText.includes(cityQuery)) &&
        (!customerQuery || customerText.includes(customerQuery)) &&
        (!orderQuery || orderText.includes(orderQuery));
    });
  }, [orders, customers, cityFilter, customerFilter, orderNumberFilter]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [cityFilter, customerFilter, orderNumberFilter]);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  const clearFilters = () => {
    setCityFilter('');
    setCustomerFilter('');
    setOrderNumberFilter('');
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

  const getStatusLabel = (estado: Order['estado']): string => {
    const labels: Partial<Record<Order['estado'], string>> = {
      pagado: 'Pagado',
      procesando: 'Procesando',
      empacado: 'Empacado',
      enviado: 'Enviado',
      entregado: 'Entregado',
    };
    return labels[estado] ?? estado;
  };

  const stats = {
    pendientes: orders.filter(o => o.estado === 'pagado' || o.estado === 'procesando' || o.estado === 'empacado').length,
    enviados: orders.filter(o => o.estado === 'enviado' || o.estado === 'en_camino').length,
    entregados: orders.filter(o => o.estado === 'entregado').length,
    total: orders.reduce((sum, o) => o.estado !== 'cancelado' ? sum + o.total : sum, 0),
  };

  const handleStatusClick = (order: Order, targetStatus: Order['estado']) => {
    if (targetStatus === 'enviado') {
      // Show the registrar guía modal instead of directly changing status
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
        <KpiCard label="Por procesar" value={String(stats.pendientes)} icon={Clock} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Enviados" value={String(stats.enviados)} icon={Truck} color="text-blue-600 bg-blue-50" />
        <KpiCard label="Entregados" value={String(stats.entregados)} icon={Package} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Ingresos" value={`$${(stats.total / 1000).toFixed(0)}k`} icon={Check} color="text-[#2a4038] bg-[#2a4038]/10" />
      </div>

      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Número de pedido</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={orderNumberFilter}
                onChange={e => setOrderNumberFilter(e.target.value)}
                placeholder="Buscar por ID o número..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Cliente</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
                placeholder="Nombre, correo o teléfono..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Ciudad</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                placeholder="Ciudad de envío o cliente..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038]"
              />
            </div>
          </div>
        </div>
        {(cityFilter || customerFilter || orderNumberFilter) && (
          <div className="flex justify-end mt-3">
            <button onClick={clearFilters} className="text-xs font-semibold text-gray-500 hover:text-[#2a4038]">
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
          const nextState = NEXT_STATE[order.estado];

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
                          {getStatusLabel(order.estado)}
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
                      onClick={() => setExpandedOrderId(current => current === order.id ? null : order.id)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Menos' : 'Ver mas'}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <div className="space-y-4">
                      <div className="grid gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cliente</p>
                          <p className="truncate text-xs font-medium text-gray-900">{customer?.nombre || 'Cliente'}</p>
                          <p className="truncate text-xs text-gray-500">{customer?.email || 'Sin correo'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ubicacion</p>
                          <p className="truncate text-xs text-gray-700">{order.direccionEnvio || 'Sin direccion registrada'}</p>
                          <p className="truncate text-xs text-gray-500">{destination || customer?.ciudad || 'Sin ciudad'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pago</p>
                          <p className="text-xs font-medium text-gray-900">${order.total.toLocaleString()}</p>
                          <p className="truncate text-xs uppercase text-gray-500">{order.metodoPago || 'Sin metodo'}</p>
                        </div>
                      </div>

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

                      {inWorkflow && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Flujo de pedido</p>
                          <div className="flex flex-wrap gap-2">
                            {WORKFLOW.map((step, index) => {
                              const currentIndex = WORKFLOW.indexOf(order.estado);
                              const isCompleted = index < currentIndex;
                              const isCurrent = step === order.estado;
                              const isNext = nextState === step;
                              const isDisabled = !isCompleted && !isCurrent && !isNext;

                              return (
                                <button
                                  key={step}
                                  disabled={isDisabled || isCurrent || isCompleted}
                                  onClick={() => handleStatusClick(order, step)}
                                  className={`h-9 rounded-lg px-3 text-[11px] font-semibold capitalize transition-colors ${
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
                                  {getStatusLabel(step)}
                                </button>
                              );
                            })}
                          </div>

                          {guiaOrderId === order.id && (
                            <AdminRegistrarGuia
                              pedidoId={order.id}
                              onSaved={() => {
                                setGuiaOrderId(null);
                                void refreshData();
                              }}
                              onCancel={() => setGuiaOrderId(null)}
                            />
                          )}
                        </div>
                      )}

                      {!inWorkflow && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Estado</p>
                          <Badge
                            label={
                              <span className="flex items-center gap-1 capitalize">
                                {getStatusIcon(order.estado)}
                                {getStatusLabel(order.estado)}
                              </span>
                            }
                            color={getStatusColor(order.estado)}
                          />
                        </div>
                      )}
                    </div>

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
