import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { Download, TrendingUp, DollarSign, ShoppingCart, Users, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getSalesReport, type SalesReport } from '../../services/reports.service';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function formatMonth(month: string): string {
  const [, monthNumber] = month.split('-');
  return MONTH_LABELS[monthNumber] ?? month;
}

const COLORS = ['#0a0a0a', '#4a4a4a', '#6a6a6a', '#8a8a8a', '#aaaaaa', '#cacaca', '#dadada'];

function ChartCard({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-secondary p-6 border border-border"
    >
      <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
        {title}
      </div>
      {children}
    </motion.div>
  );
}

function ChartSkeleton() {
  return <div className="h-[250px] animate-pulse bg-background/60" />;
}

export function AdminReports() {
  const { orders } = useAdmin();
  const [report, setReport] = useState<SalesReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const loadReport = () => {
    setStatus('loading');
    getSalesReport()
      .then(data => {
        setReport(data);
        setStatus('success');
      })
      .catch(error => {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar el reporte.');
        setStatus('error');
      });
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExportExcel = () => {
    alert('Exportando reporte a Excel... (Funcionalidad de demostración)');
  };

  const totalVentas = orders.reduce((sum, o) => o.estado !== 'cancelado' ? sum + o.total : sum, 0);
  const ordenesValidas = orders.filter(o => o.estado !== 'cancelado').length;
  const promedioVenta = ordenesValidas > 0 ? totalVentas / ordenesValidas : 0;
  const tasaConversion = (report?.conversion_rate ?? 0).toFixed(1);

  const monthlySales = report?.monthly_sales ?? [];
  const lastMonth = monthlySales[monthlySales.length - 1];
  const prevMonth = monthlySales[monthlySales.length - 2];
  const salesDelta = prevMonth && prevMonth.total > 0
    ? ((lastMonth.total - prevMonth.total) / prevMonth.total) * 100
    : null;
  const ordersDelta = prevMonth && prevMonth.orders > 0
    ? ((lastMonth.orders - prevMonth.orders) / prevMonth.orders) * 100
    : null;

  const monthlySalesChartData = monthlySales.map(item => ({
    mes: formatMonth(item.month),
    ventas: item.total,
    pedidos: item.orders,
  }));

  const categoryChartData = (report?.sales_by_category ?? []).map(item => ({
    nombre: item.category,
    ventas: item.total,
  }));

  const topProductsChartData = (report?.top_products ?? []).map((item, index) => ({
    nombre: `${index + 1}. ${item.name.substring(0, 18)}`,
    unidades: item.units,
  }));

  const customerSegments = report?.customer_segments ?? [];

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
          {salesDelta !== null && (
            <div className={`text-[10px] ${salesDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {salesDelta >= 0 ? '+' : ''}{salesDelta.toFixed(0)}% vs mes anterior
            </div>
          )}
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
          {ordersDelta !== null && (
            <div className={`text-[10px] ${ordersDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {ordersDelta >= 0 ? '+' : ''}{ordersDelta.toFixed(0)}% vs mes anterior
            </div>
          )}
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
        </motion.div>
      </div>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4" strokeWidth={1} />
            {errorMessage}
          </div>
          <button
            onClick={loadReport}
            className="px-3 py-1.5 border border-red-300 text-red-700 text-xs uppercase tracking-wider hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <ChartCard title={`Ventas Mensuales (últimos ${monthlySales.length || 6} meses)`} delay={0.4}>
          {status === 'loading' ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlySalesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis tick={{ fontSize: 10 }} stroke="#999" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="ventas" stroke="#0a0a0a" strokeWidth={2} name="Ventas ($)" dot={false} />
                <Line type="monotone" dataKey="pedidos" stroke="#8a8a8a" strokeWidth={2} name="Pedidos" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ventas por Categoría" delay={0.5}>
          {status === 'loading' ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ nombre, percent }: any) => `${nombre} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="ventas"
                  nameKey="nombre"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`pie-cell-${index}-${entry.nombre}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top 5 Productos" delay={0.6}>
          {status === 'loading' ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProductsChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 9 }} width={120} stroke="#999" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="unidades" fill="#0a0a0a" name="Unidades" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Segmentación de Clientes" delay={0.7}>
          {status === 'loading' ? <ChartSkeleton /> : (
            <div className="space-y-4">
              {customerSegments.map(segment => (
                <div key={segment.segment}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs">{segment.segment}</div>
                    <div className="text-xs text-muted-foreground">
                      {segment.count} ({segment.percentage}%)
                    </div>
                  </div>
                  <div className="h-2 bg-background overflow-hidden">
                    <div
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${segment.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
