import { useState, useMemo } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { TrendingUp, ShoppingCart, AlertTriangle, Users, DollarSign, Package, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { KpiCard, Card, Badge, type BadgeColor } from './AdminUI';

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

  const orderStatusColor = (estado: string): BadgeColor => ({
    entregado: 'green',
    enviado: 'blue',
    pagado: 'purple',
  } as Record<string, BadgeColor>)[estado] ?? 'yellow';

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
          <p className="text-xs text-gray-500 mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>

        {/* Backend status + refresh */}
        <div className="flex items-center gap-2">
          <Badge label={
            <span className="flex items-center gap-1.5">
              {backendOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {backendOnline ? 'API Online' : 'Modo Demo'}
            </span>
          } color={backendOnline ? 'green' : 'yellow'} />
          <button
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Hoy" value={`$${(ventasHoy / 1000).toFixed(0)}k`} icon={DollarSign} color="text-[#2a4038] bg-[#2a4038]/10" />
        <KpiCard label="Este mes" value={`$${(ventasMes / 1000).toFixed(0)}k`} icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Pendientes" value={String(pedidosPendientes)} icon={ShoppingCart} color="text-blue-600 bg-blue-50" />
        <KpiCard label="Stock bajo" value={String(productosStockBajo)} icon={AlertTriangle} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Nuevos" value={String(clientesNuevos)} icon={Users} color="text-purple-600 bg-purple-50" />
        <KpiCard label="Productos" value={String(products.length)} icon={Package} color="text-gray-600 bg-gray-100" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Ventas Última Semana</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#999" />
              <YAxis tick={{ fontSize: 10 }} stroke="#999" />
              <Tooltip />
              <Line type="monotone" dataKey="ventas" stroke="#2a4038" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Productos Más Vendidos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="nombre" tick={{ fontSize: 9 }} stroke="#999" />
              <YAxis tick={{ fontSize: 10 }} stroke="#999" />
              <Tooltip />
              <Bar dataKey="ventas" fill="#2a4038" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Orders & Low Stock Alerts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Pedidos Recientes</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {orders.slice(0, 5).map((order) => {
              const customer = customers.find(c => c.id === order.clienteId);
              return (
                <div key={order.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-900">{customer?.nombre || 'Cliente'}</p>
                    <Badge label={order.estado} color={orderStatusColor(order.estado)} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>{order.productos.length} producto(s)</span>
                    <span className="font-semibold text-gray-700">${order.total.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Alertas de Inventario</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {inventory
              .filter(inv => inv.stockActual < inv.stockMinimo)
              .map((inv) => {
                const product = products.find(p => p.id === inv.productoId);
                return (
                  <div key={inv.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900 mb-0.5">{product?.nombre}</p>
                        <p className="text-[11px] text-gray-400">Stock: {inv.stockActual} / Mínimo: {inv.stockMinimo}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            {inventory.filter(inv => inv.stockActual < inv.stockMinimo).length === 0 && (
              <div className="p-6 text-xs text-gray-400 text-center">
                ✓ Todos los productos tienen stock suficiente
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}