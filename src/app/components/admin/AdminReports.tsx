import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { Download, TrendingUp, DollarSign, ShoppingCart, Users } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function AdminReports() {
  const { orders, products, customers } = useAdmin();

  // Sales data by category — unique keys guaranteed by reduce
  const categoryData = useMemo(() => {
    const salesByCategory = products.reduce((acc, product, index) => {
      const category = product.categoria;
      if (!acc[category]) {
        acc[category] = { nombre: category, ventas: 0 };
      }
      acc[category].ventas += Math.floor(Math.random() * 100000) + 50000 + index;
      return acc;
    }, {} as Record<string, { nombre: string; ventas: number }>);
    return Object.values(salesByCategory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  const COLORS = ['#0a0a0a', '#4a4a4a', '#8a8a8a', '#cacaca'];

  // Monthly sales
  const monthlySales = [
    { mes: 'Ene', ventas: 2450000, pedidos: 45 },
    { mes: 'Feb', ventas: 2890000, pedidos: 52 },
    { mes: 'Mar', ventas: 3120000, pedidos: 58 },
    { mes: 'Abr', ventas: 2980000, pedidos: 54 },
    { mes: 'May', ventas: 3450000, pedidos: 63 },
  ];

  // Top products — index prefix ensures unique nombres
  const topProducts = useMemo(() =>
    products
      .slice(0, 5)
      .map((p, index) => ({
        nombre: `${index + 1}. ${p.nombre.substring(0, 10)}`,
        unidades: Math.floor(Math.random() * 100) + 20 + index,
        ingresos: Math.floor(Math.random() * 500000) + 100000 + (index * 1000),
      })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [products.length]);

  // Customer segments
  const customerSegments = [
    { segment: 'Nuevos', cantidad: 12, porcentaje: 20 },
    { segment: 'Recurrentes', cantidad: 28, porcentaje: 47 },
    { segment: 'VIP', cantidad: 8, porcentaje: 13 },
    { segment: 'Inactivos', cantidad: 12, porcentaje: 20 },
  ];

  const handleExportExcel = () => {
    alert('Exportando reporte a Excel... (Funcionalidad de demostración)');
  };

  const totalVentas = orders.reduce((sum, o) => o.estado !== 'cancelado' ? sum + o.total : sum, 0);
  const promedioVenta = totalVentas / orders.filter(o => o.estado !== 'cancelado').length;
  const tasaConversion = ((orders.filter(o => o.estado !== 'cancelado').length / customers.length) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2">Reportes</h1>
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            Análisis y métricas de negocio
          </div>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
        >
          <Download className="w-4 h-4" strokeWidth={1} />
          Exportar Excel
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Ingresos Totales
            </div>
          </div>
          <div className="text-xl mb-1">${(totalVentas / 1000).toFixed(0)}k</div>
          <div className="text-[10px] text-green-600">+12% vs mes anterior</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Pedidos
            </div>
          </div>
          <div className="text-xl mb-1">{orders.length}</div>
          <div className="text-[10px] text-green-600">+8% vs mes anterior</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Ticket Promedio
            </div>
          </div>
          <div className="text-xl mb-1">${(promedioVenta / 1000).toFixed(1)}k</div>
          <div className="text-[10px] text-green-600">+5% vs mes anterior</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Tasa Conversión
            </div>
          </div>
          <div className="text-xl mb-1">{tasaConversion}%</div>
          <div className="text-[10px] text-green-600">+3% vs mes anterior</div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-secondary p-6 border border-border"
        >
          <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
            Ventas Mensuales (2026)
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="#999" />
              <YAxis tick={{ fontSize: 10 }} stroke="#999" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="ventas" stroke="#0a0a0a" strokeWidth={2} name="Ventas ($)" dot={false} />
              <Line type="monotone" dataKey="pedidos" stroke="#8a8a8a" strokeWidth={2} name="Pedidos" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-secondary p-6 border border-border"
        >
          <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
            Ventas por Categoría
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ nombre, percent }: any) => `${nombre} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="ventas"
                nameKey="nombre"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`pie-cell-${index}-${entry.nombre}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-secondary p-6 border border-border"
        >
          <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
            Top 5 Productos
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#999" />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 9 }} width={100} stroke="#999" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="unidades" fill="#0a0a0a" name="Unidades" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-secondary p-6 border border-border"
        >
          <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
            Segmentación de Clientes
          </div>
          <div className="space-y-4">
            {customerSegments.map((segment, index) => (
              <div key={`segment-${index}-${segment.segment}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs">{segment.segment}</div>
                  <div className="text-xs text-muted-foreground">
                    {segment.cantidad} ({segment.porcentaje}%)
                  </div>
                </div>
                <div className="h-2 bg-background overflow-hidden">
                  <div
                    className="h-full bg-foreground transition-all"
                    style={{ width: `${segment.porcentaje}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}