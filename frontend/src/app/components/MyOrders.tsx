import { useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Package, Truck, Check, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface MyOrdersProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyOrders({ isOpen, onClose }: MyOrdersProps) {
  const { orders, loadOrders, backendOnline } = useUser();

  // Refresh orders from API when opened
  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen, loadOrders]);

  if (!isOpen) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pendiente':
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" strokeWidth={1} />;
      case 'procesando':
      case 'processing':
      case 'confirmed':
        return <Package className="w-4 h-4 text-blue-600" strokeWidth={1} />;
      case 'enviado':
      case 'shipped':
        return <Truck className="w-4 h-4 text-purple-600" strokeWidth={1} />;
      case 'entregado':
      case 'delivered':
        return <Check className="w-4 h-4 text-green-600" strokeWidth={1} />;
      case 'cancelado':
      case 'cancelled':
      case 'refunded':
        return <AlertCircle className="w-4 h-4 text-red-600" strokeWidth={1} />;
      default:
        return <Package className="w-4 h-4" strokeWidth={1} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pendiente':
      case 'pending':
        return 'Pendiente de pago';
      case 'procesando':
      case 'processing':
        return 'Procesando';
      case 'confirmed':
        return 'Confirmado';
      case 'enviado':
      case 'shipped':
        return 'En camino';
      case 'entregado':
      case 'delivered':
        return 'Entregado';
      case 'cancelado':
      case 'cancelled':
        return 'Cancelado';
      case 'refunded':
        return 'Reembolsado';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente':
      case 'pending':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'procesando':
      case 'processing':
      case 'confirmed':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'enviado':
      case 'shipped':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      case 'entregado':
      case 'delivered':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'cancelado':
      case 'cancelled':
      case 'refunded':
        return 'bg-red-50 border-red-200 text-red-900';
      default:
        return 'bg-secondary border-border';
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-foreground/40 z-50"
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-3xl bg-background z-50 flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-border flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="text-xs tracking-[0.2em] uppercase">
                Mis Pedidos
              </div>
              {backendOnline && (
                <span className="text-[9px] tracking-widest uppercase px-2 py-0.5 bg-green-50 border border-green-200 text-green-700">
                  sincronizado
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} en total
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadOrders}
              className="hover:opacity-50 transition-opacity"
              title="Actualizar pedidos"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1} />
            </button>
            <button
              onClick={onClose}
              className="hover:opacity-50 transition-opacity"
            >
              <X className="w-5 h-5" strokeWidth={1} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {orders.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" strokeWidth={1} />
              <div className="text-sm text-muted-foreground mb-2">
                No tienes pedidos aún
              </div>
              <div className="text-xs text-muted-foreground">
                Cuando realices tu primera compra aparecerá aquí
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-border p-6 hover:border-foreground/20 transition-colors"
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-6 pb-4 border-b border-border">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {order.order_number ? `Pedido #${order.order_number}` : `Pedido #${order.id}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.fecha).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-2 border ${getStatusColor(order.estado)}`}>
                      {getStatusIcon(order.estado)}
                      <span className="text-[10px] tracking-wider uppercase font-medium">
                        {getStatusText(order.estado)}
                      </span>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="space-y-3 mb-4">
                    {order.productos.map((producto, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div>
                          <div>{producto.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            Cantidad: {producto.cantidad}
                          </div>
                        </div>
                        <div className="text-right">
                          ${(producto.precio * producto.cantidad).toLocaleString('es-CO')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between pt-4 border-t border-border">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-sm font-medium">
                      ${order.total.toLocaleString('es-CO')}
                    </span>
                  </div>

                  {/* Shipping Address */}
                  {order.direccionEnvio && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-2">
                        Dirección de envío
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.direccionEnvio}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}