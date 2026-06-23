import { useAdmin } from '../../contexts/AdminContext';
import { Package, Clock, Check, X, Truck, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import type { Order } from '../../types/admin';
import { AdminRegistrarGuia } from './AdminRegistrarGuia';
import { KpiCard, Card, Badge, type BadgeColor } from './AdminUI';
import { InteractiveLocationMap } from '../ui/InteractiveLocationMap';

const noop = () => {};

export function AdminOrders() {
  const { orders, customers, updateOrderStatus } = useAdmin();

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

  const statusOptions: Order['estado'][] = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

  const stats = {
    pendientes: orders.filter(o => o.estado === 'pendiente').length,
    enviados: orders.filter(o => o.estado === 'enviado').length,
    entregados: orders.filter(o => o.estado === 'entregado').length,
    total: orders.reduce((sum, o) => o.estado !== 'cancelado' ? sum + o.total : sum, 0),
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Pedidos</h2>
        <p className="text-xs text-gray-500 mt-0.5">{orders.length} pedidos totales</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Pendientes" value={String(stats.pendientes)} icon={Clock} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Enviados" value={String(stats.enviados)} icon={Truck} color="text-blue-600 bg-blue-50" />
        <KpiCard label="Entregados" value={String(stats.entregados)} icon={Package} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Ingresos" value={`$${(stats.total / 1000).toFixed(0)}k`} icon={Check} color="text-[#2a4038] bg-[#2a4038]/10" />
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => {
          const customer = customers.find(c => c.id === order.clienteId);

          return (
            <Card key={order.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-sm font-semibold text-gray-900">Pedido #{order.id}</p>
                    <Badge label={
                      <span className="flex items-center gap-1 capitalize">
                        {getStatusIcon(order.estado)}
                        {order.estado}
                      </span>
                    } color={getStatusColor(order.estado)} />
                  </div>
                  <p className="text-xs text-gray-400">{format(new Date(order.fecha), "dd/MM/yyyy 'a las' HH:mm")}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 mb-1">${order.total.toLocaleString()}</p>
                  {order.metodoPago && (
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{order.metodoPago}</p>
                  )}
                </div>
              </div>

              <div className="mb-4 pb-4 border-b border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Cliente</p>
                <p className="text-xs font-medium text-gray-900">{customer?.nombre || 'Cliente'}</p>
                <p className="text-xs text-gray-400">{customer?.email}</p>
                <p className="text-xs text-gray-400">{customer?.ciudad}</p>
              </div>

              {(order.direccionEnvio || (order.latitudEnvio && order.longitudEnvio)) && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                    <MapPin size={12} /> Dirección de envío
                  </p>
                  <p className="text-xs text-gray-700 mb-1">{order.direccionEnvio}</p>
                  <p className="text-xs text-gray-400 mb-3">
                    {[order.ciudadEnvio, order.departamentoEnvio, order.paisEnvio].filter(Boolean).join(', ')}
                  </p>
                  {order.latitudEnvio != null && order.longitudEnvio != null && (
                    <InteractiveLocationMap
                      lat={order.latitudEnvio}
                      lng={order.longitudEnvio}
                      onMarkerMove={noop}
                      readOnly
                      className="h-48 rounded-xl overflow-hidden border border-gray-200"
                    />
                  )}
                </div>
              )}

              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Productos ({order.productos.length})
                </p>
                <div className="space-y-2">
                  {order.productos.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-[10px] text-gray-500">
                          {item.cantidad}x
                        </span>
                        <span className="text-gray-700">{item.nombre}</span>
                      </div>
                      <span className="font-medium text-gray-900">${(item.precio * item.cantidad).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Cambiar Estado</p>
                <div className="flex gap-2">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      onClick={() => updateOrderStatus(order.id, status)}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-semibold capitalize transition-colors ${
                        order.estado === status
                          ? 'bg-[#2a4038] text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <AdminRegistrarGuia
                  pedidoId={order.id}
                  onSaved={() => void updateOrderStatus(order.id, 'enviado')}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
