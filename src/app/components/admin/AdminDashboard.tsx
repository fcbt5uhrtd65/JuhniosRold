import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { TrendingUp, ShoppingCart, AlertTriangle, Users, DollarSign, Package, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';

export function AdminDashboard() {
  const { orders, products, inventory, customers, backendOnline, isLoading, refreshData } = useAdmin();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // Calculate metrics
  const today = new Date().toDateString();
  const ventasHoy = orders
    .filter(o => new Date(o.fecha).toDateString() === today && o.estado !== 'cancelado')
    .reduce((sum, o) => sum + o.total, 0);

  const thisMonth = new Date().getMonth();
  const ventasMes = orders
    .filter(o => new Date(o.fecha).getMonth() === thisMonth && o.estado !== 'cancelado')
    .reduce((sum, o) => sum + o.total, 0);

  const pedidosPendientes = orders.filter(o => o.estado === 'pendiente').length;

  const productosStockBajo = inventory.filter(
    inv => inv.stockActual < inv.stockMinimo
  ).length;

  const clientesNuevos = customers.filter(c => {
    if (!c.ultimaCompra) return false;
    const daysSince = (Date.now() - new Date(c.ultimaCompra).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 30;
  }).length;

  // Chart data
  const salesData = [
    { name: 'Lun', ventas: 145000 },
    { name: 'Mar', ventas: 189000 },
    { name: 'Mié', ventas: 234000 },
    { name: 'Jue', ventas: 198000 },
    { name: 'Vie', ventas: 276000 },
    { name: 'Sáb', ventas: 312000 },
    { name: 'Dom', ventas: 156000 },
  ];

  const topProducts = useMemo(() =>
    products
      .slice(0, 5)
      .map((p, index) => ({
        nombre: `${index + 1}. ${p.nombre.substring(0, 10)}`,
        ventas: Math.floor(Math.random() * 50) + 10 + index,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products.length]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl mb-2">Dashboard</h1>
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </div>
        </div>

        {/* Backend status + refresh */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] tracking-widest uppercase ${
            backendOnline
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {backendOnline
              ? <Wifi className="w-3 h-3" strokeWidth={1.5} />
              : <WifiOff className="w-3 h-3" strokeWidth={1.5} />
            }
            <span>{backendOnline ? 'API Online' : 'Modo Demo'}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase hover:bg-secondary transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Hoy
            </div>
          </div>
          <div className="text-xl">${(ventasHoy / 1000).toFixed(0)}k</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Este mes
            </div>
          </div>
          <div className="text-xl">${(ventasMes / 1000).toFixed(0)}k</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Pendientes
            </div>
          </div>
          <div className="text-xl">{pedidosPendientes}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Stock bajo
            </div>
          </div>
          <div className="text-xl">{productosStockBajo}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Nuevos
            </div>
          </div>
          <div className="text-xl">{clientesNuevos}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Productos
            </div>
          </div>
          <div className="text-xl">{products.length}</div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-secondary p-6 border border-border"
        >
          <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
            Ventas Última Semana
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#999" />
              <YAxis tick={{ fontSize: 10 }} stroke="#999" />
              <Tooltip />
              <Line type="monotone" dataKey="ventas" stroke="#0a0a0a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-secondary p-6 border border-border"
        >
          <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
            Productos Más Vendidos
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="nombre" tick={{ fontSize: 9 }} stroke="#999" />
              <YAxis tick={{ fontSize: 10 }} stroke="#999" />
              <Tooltip />
              <Bar dataKey="ventas" fill="#0a0a0a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent Orders & Low Stock Alerts */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-secondary border border-border"
        >
          <div className="p-4 border-b border-border">
            <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
              Pedidos Recientes
            </div>
          </div>
          <div className="divide-y divide-border">
            {orders.slice(0, 5).map((order) => {
              const customer = customers.find(c => c.id === order.clienteId);
              return (
                <div key={order.id} className="p-4 hover:bg-background/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs">{customer?.nombre || 'Cliente'}</div>
                    <div className={`text-[10px] px-2 py-1 ${
                      order.estado === 'entregado' ? 'bg-green-100 text-green-800' :
                      order.estado === 'enviado' ? 'bg-blue-100 text-blue-800' :
                      order.estado === 'pagado' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.estado}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <div>{order.productos.length} producto(s)</div>
                    <div className="font-medium text-foreground">${order.total.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-secondary border border-border"
        >
          <div className="p-4 border-b border-border">
            <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
              Alertas de Inventario
            </div>
          </div>
          <div className="divide-y divide-border">
            {inventory
              .filter(inv => inv.stockActual < inv.stockMinimo)
              .map((inv) => {
                const product = products.find(p => p.id === inv.productoId);
                return (
                  <div key={inv.id} className="p-4 hover:bg-background/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" strokeWidth={1} />
                      <div className="flex-1">
                        <div className="text-xs mb-1">{product?.nombre}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Stock: {inv.stockActual} / Mínimo: {inv.stockMinimo}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            {inventory.filter(inv => inv.stockActual < inv.stockMinimo).length === 0 && (
              <div className="p-4 text-xs text-muted-foreground text-center">
                ✓ Todos los productos tienen stock suficiente
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}