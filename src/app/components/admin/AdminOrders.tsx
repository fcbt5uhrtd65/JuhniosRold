import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { Package, Clock, Check, X, Truck } from 'lucide-react';
import { format } from 'date-fns';
import type { Order } from '../../types/admin';

export function AdminOrders() {
  const { orders, customers, updateOrderStatus } = useAdmin();

  const getStatusIcon = (estado: Order['estado']) => {
    switch (estado) {
      case 'pendiente':
        return <Clock className="w-4 h-4" strokeWidth={1} />;
      case 'pagado':
        return <Check className="w-4 h-4" strokeWidth={1} />;
      case 'enviado':
        return <Truck className="w-4 h-4" strokeWidth={1} />;
      case 'entregado':
        return <Package className="w-4 h-4" strokeWidth={1} />;
      case 'cancelado':
        return <X className="w-4 h-4" strokeWidth={1} />;
    }
  };

  const getStatusColor = (estado: Order['estado']) => {
    switch (estado) {
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'pagado':
        return 'bg-purple-100 text-purple-800';
      case 'enviado':
        return 'bg-blue-100 text-blue-800';
      case 'entregado':
        return 'bg-green-100 text-green-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-2">Pedidos</h1>
        <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          {orders.length} pedidos totales
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
            Pendientes
          </div>
          <div className="text-xl">{stats.pendientes}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Enviados
          </div>
          <div className="text-xl">{stats.enviados}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Entregados
          </div>
          <div className="text-xl">{stats.entregados}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Ingresos
          </div>
          <div className="text-xl">${(stats.total / 1000).toFixed(0)}k</div>
        </motion.div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => {
          const customer = customers.find(c => c.id === order.clienteId);

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-secondary border border-border"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-sm">Pedido #{order.id}</div>
                      <div className={`flex items-center gap-1 text-[10px] px-2 py-1 ${getStatusColor(order.estado)}`}>
                        {getStatusIcon(order.estado)}
                        <span className="capitalize">{order.estado}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(order.fecha), "dd/MM/yyyy 'a las' HH:mm")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg mb-1">${order.total.toLocaleString()}</div>
                    {order.metodoPago && (
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {order.metodoPago}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4 pb-4 border-b border-border">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
                    Cliente
                  </div>
                  <div className="text-xs">{customer?.nombre || 'Cliente'}</div>
                  <div className="text-xs text-muted-foreground">{customer?.email}</div>
                  <div className="text-xs text-muted-foreground">{customer?.ciudad}</div>
                </div>

                <div className="mb-4">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                    Productos ({order.productos.length})
                  </div>
                  <div className="space-y-2">
                    {order.productos.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-background flex items-center justify-center text-[10px] text-muted-foreground">
                            {item.cantidad}x
                          </div>
                          <div>{item.nombre}</div>
                        </div>
                        <div>${(item.precio * item.cantidad).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
                    Cambiar Estado
                  </div>
                  <div className="flex gap-2">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => updateOrderStatus(order.id, status)}
                        className={`flex-1 py-2 text-[10px] tracking-wider uppercase border transition-colors ${
                          order.estado === status
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border hover:bg-background'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
