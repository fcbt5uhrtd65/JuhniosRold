import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Download,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Package,
  PieChart as PieChartIcon,
  RefreshCw,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getSalesReport,
  requestSalesReportExport,
  getSalesReportExportStatus,
  type SalesReport,
  type SalesReportExportFormat,
} from '../../services/reports.service';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';
import { pollExportStatus } from '../../utils/pollExportStatus';
import { resolveBackendUrl } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Card, KpiCard } from './AdminUI';
import type { Order } from '../../types/admin';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dic',
};

const STATUS_LABELS: Record<Order['estado'], string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  procesando: 'Procesando',
  empacado: 'Empacado',
  pagado: 'Pagado',
  enviado: 'Enviado',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  devuelto: 'Devuelto',
  fallido: 'Fallido',
};

const COLORS = ['#2a4038', '#5a8a73', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#64748b'];
const NON_REVENUE_STATUSES: Order['estado'][] = ['cancelado', 'devuelto', 'fallido'];

function formatMonth(month: string): string {
  const [, monthNumber] = month.split('-');
  return MONTH_LABELS[monthNumber] ?? month;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Sin base';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function getDelta(current?: number, previous?: number): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function isRevenueOrder(order: Order): boolean {
  return !NON_REVENUE_STATUSES.includes(order.estado);
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function ChartSkeleton() {
  return <div className="h-[280px] animate-pulse rounded-lg bg-gray-50" />;
}

function MiniStat({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

export function AdminReports() {
  const { orders, customers } = useAdmin();
  const toast = useToast();
  const [report, setReport] = useState<SalesReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExport = async (format: SalesReportExportFormat) => {
    setIsExporting(true);
    toast.info('Generando exportacion, esto puede tardar unos segundos...');
    try {
      const taskId = await requestSalesReportExport(format);
      const relativeUrl = await pollExportStatus(taskId, getSalesReportExportStatus);
      window.open(resolveBackendUrl(relativeUrl), '_blank');
      toast.success('Exportacion lista.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el reporte');
    } finally {
      setIsExporting(false);
    }
  };

  const analytics = useMemo(() => {
    const validOrders = orders.filter(isRevenueOrder);
    const cancelledOrders = orders.filter(order => !isRevenueOrder(order));
    const totalSales = validOrders.reduce((sum, order) => sum + order.total, 0);
    const averageTicket = validOrders.length > 0 ? totalSales / validOrders.length : 0;
    const deliveredOrders = orders.filter(order => order.estado === 'entregado').length;
    const fulfillmentRate = orders.length > 0 ? (deliveredOrders / orders.length) * 100 : 0;
    const cancellationRate = orders.length > 0 ? (cancelledOrders.length / orders.length) * 100 : 0;

    const productMap = new Map<string, { name: string; units: number; revenue: number }>();
    validOrders.forEach(order => {
      order.productos.forEach(item => {
        const current = productMap.get(item.nombre) ?? { name: item.nombre, units: 0, revenue: 0 };
        current.units += item.cantidad;
        current.revenue += item.precio * item.cantidad;
        productMap.set(item.nombre, current);
      });
    });

    const productsByRevenue = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
    const productUnits = productsByRevenue.reduce((sum, item) => sum + item.units, 0);
    const topProductRevenueShare = totalSales > 0 && productsByRevenue[0]
      ? (productsByRevenue[0].revenue / totalSales) * 100
      : 0;

    const customerSales = new Map<string, { name: string; orders: number; revenue: number }>();
    validOrders.forEach(order => {
      const customer = customers.find(item => item.id === order.clienteId);
      const name = customer?.nombre || `Cliente ${order.clienteId}`;
      const current = customerSales.get(order.clienteId) ?? { name, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += order.total;
      customerSales.set(order.clienteId, current);
    });

    const topCustomers = Array.from(customerSales.values()).sort((a, b) => b.revenue - a.revenue);
    const repeatCustomers = topCustomers.filter(customer => customer.orders > 1).length;
    const repeatRate = topCustomers.length > 0 ? (repeatCustomers / topCustomers.length) * 100 : 0;

    const statusBreakdown = Object.entries(
      orders.reduce<Record<string, number>>((acc, order) => {
        acc[order.estado] = (acc[order.estado] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([estado, count], index) => ({
      estado: STATUS_LABELS[estado as Order['estado']] ?? estado,
      count,
      fill: COLORS[index % COLORS.length],
    }));

    const dailySales = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - index));
      const key = date.toISOString().slice(0, 10);
      const dayOrders = validOrders.filter(order => order.fecha.slice(0, 10) === key);
      return {
        dia: format(date, 'dd/MM'),
        ventas: dayOrders.reduce((sum, order) => sum + order.total, 0),
        pedidos: dayOrders.length,
      };
    });

    return {
      validOrders,
      totalSales,
      averageTicket,
      fulfillmentRate,
      cancellationRate,
      productsByRevenue,
      productUnits,
      topProductRevenueShare,
      topCustomers,
      repeatRate,
      statusBreakdown,
      dailySales,
    };
  }, [orders, customers]);

  const monthlySales = report?.monthly_sales ?? [];
  const lastMonth = monthlySales[monthlySales.length - 1];
  const prevMonth = monthlySales[monthlySales.length - 2];
  const salesDelta = getDelta(lastMonth?.total, prevMonth?.total);
  const ordersDelta = getDelta(lastMonth?.orders, prevMonth?.orders);
  const bestMonth = monthlySales.reduce<typeof monthlySales[number] | null>(
    (best, item) => (!best || item.total > best.total ? item : best),
    null,
  );

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
    nombre: `${index + 1}. ${item.name.substring(0, 22)}`,
    unidades: item.units,
    ingresos: item.revenue,
  }));

  const customerSegments = report?.customer_segments ?? [];
  const conversionRate = report?.conversion_rate ?? 0;

  const insights = [
    salesDelta !== null && salesDelta >= 0
      ? `Ventas creciendo ${formatPercent(salesDelta)} frente al mes anterior.`
      : salesDelta !== null
        ? `Ventas bajaron ${Math.abs(salesDelta).toFixed(1)}% frente al mes anterior. Revisar campanas y recompra.`
        : 'Aun no hay base mensual suficiente para comparar crecimiento.',
    analytics.cancellationRate > 12
      ? `Cancelaciones en ${analytics.cancellationRate.toFixed(1)}%; conviene auditar pagos, inventario y tiempos de despacho.`
      : `Cancelaciones controladas en ${analytics.cancellationRate.toFixed(1)}%.`,
    analytics.topProductRevenueShare > 35
      ? `Alta concentracion: el producto lider aporta ${analytics.topProductRevenueShare.toFixed(1)}% de ingresos.`
      : `Portafolio balanceado: el producto lider no domina excesivamente los ingresos.`,
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-[#2a4038]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#2a4038]">
            <BarChart3 size={13} />
            Inteligencia comercial
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Reportes</h2>
          <p className="mt-1 text-xs text-gray-500">
            Ventas, pedidos, clientes, productos y salud operativa para tomar decisiones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadReport}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isExporting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2a4038] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#3d5c4e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={14} />
                Exportar reporte
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handleExport('pdf')}>
                <FileText className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Descargar PDF ejecutivo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport('xlsx')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Descargar Excel editable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          label="Ingresos"
          value={formatCurrency(analytics.totalSales)}
          icon={DollarSign}
          color="text-[#2a4038] bg-[#2a4038]/10"
          trend={salesDelta !== null ? `${formatPercent(salesDelta)} vs mes ant.` : undefined}
        />
        <KpiCard
          label="Pedidos validos"
          value={String(analytics.validOrders.length)}
          icon={ShoppingCart}
          color="text-blue-600 bg-blue-50"
          trend={ordersDelta !== null ? `${formatPercent(ordersDelta)} vs mes ant.` : undefined}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatCurrency(analytics.averageTicket)}
          icon={TrendingUp}
          color="text-emerald-600 bg-emerald-50"
        />
        <KpiCard
          label="Conversion"
          value={`${conversionRate.toFixed(1)}%`}
          icon={Target}
          color="text-purple-600 bg-purple-50"
        />
      </div>

      {status === 'error' && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle size={15} />
            {errorMessage}
          </div>
          <button
            onClick={loadReport}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Resumen ejecutivo</h3>
              <p className="mt-1 text-xs text-gray-500">Lectura rapida del desempeno comercial.</p>
            </div>
            <CalendarDays size={18} className="text-gray-400" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MiniStat
              label="Mejor mes"
              value={bestMonth ? formatMonth(bestMonth.month) : 'Sin datos'}
              detail={bestMonth ? `${formatCurrency(bestMonth.total)} en ${bestMonth.orders} pedidos` : 'Esperando ventas'}
              icon={<ArrowUpRight size={16} />}
            />
            <MiniStat
              label="Entrega"
              value={`${analytics.fulfillmentRate.toFixed(1)}%`}
              detail="Pedidos entregados sobre total"
              icon={<Package size={16} />}
            />
            <MiniStat
              label="Recompra"
              value={`${analytics.repeatRate.toFixed(1)}%`}
              detail="Clientes con mas de un pedido"
              icon={<Users size={16} />}
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {insights.map((insight, index) => (
              <div key={insight} className="rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Insight {index + 1}
                </span>
                {insight}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Salud operativa</h3>
            <p className="mt-1 text-xs text-gray-500">Estados que afectan caja, despacho y servicio.</p>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">Cumplimiento</span>
                <span className="font-semibold text-gray-900">{analytics.fulfillmentRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-[#2a4038]" style={{ width: `${Math.min(100, analytics.fulfillmentRate)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">Cancelaciones / fallidos</span>
                <span className="font-semibold text-gray-900">{analytics.cancellationRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(100, analytics.cancellationRate)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">Concentracion producto lider</span>
                <span className="font-semibold text-gray-900">{analytics.topProductRevenueShare.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, analytics.topProductRevenueShare)}%` }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title={`Ventas mensuales (${monthlySales.length || 6} meses)`} subtitle="Tendencia de ingresos y volumen de pedidos.">
          {status === 'loading' ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlySalesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#999" />
                <Tooltip formatter={(value: number, name) => name === 'Ventas' ? formatCurrency(value) : value} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="ventas" stroke="#2a4038" strokeWidth={2.5} name="Ventas" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="pedidos" stroke="#2563eb" strokeWidth={2} name="Pedidos" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ventas ultimos 14 dias" subtitle="Pulso reciente del negocio.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="#999" />
              <YAxis tick={{ fontSize: 10 }} stroke="#999" />
              <Tooltip formatter={(value: number, name) => name === 'Ventas' ? formatCurrency(value) : value} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ventas" fill="#2a4038" name="Ventas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ChartCard title="Ventas por categoria" subtitle="Participacion por linea comercial.">
          {status === 'loading' ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="ventas"
                  nameKey="nombre"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`pie-cell-${entry.nombre}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ranking de productos" subtitle="Unidades e ingresos de los productos con mejor salida.">
          {status === 'loading' ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProductsChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 9 }} width={150} stroke="#999" />
                <Tooltip formatter={(value: number, name) => name === 'Ingresos' ? formatCurrency(value) : value} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="unidades" fill="#5a8a73" name="Unidades" radius={[0, 4, 4, 0]} />
                <Bar dataKey="ingresos" fill="#2a4038" name="Ingresos" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Estados de pedidos" subtitle="Distribucion operativa actual.">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={analytics.statusBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={85}
                dataKey="count"
                nameKey="estado"
              >
                {analytics.statusBreakdown.map(entry => (
                  <Cell key={entry.estado} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Clientes clave</h3>
              <p className="mt-1 text-xs text-gray-500">Mayor valor acumulado.</p>
            </div>
            <Users size={18} className="text-gray-400" />
          </div>
          <div className="space-y-3">
            {analytics.topCustomers.slice(0, 5).map((customer, index) => (
              <div key={customer.name} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900">{index + 1}. {customer.name}</p>
                  <p className="text-[11px] text-gray-500">{customer.orders} pedidos</p>
                </div>
                <p className="shrink-0 text-xs font-bold text-gray-900">{formatCurrency(customer.revenue)}</p>
              </div>
            ))}
            {analytics.topCustomers.length === 0 && (
              <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">Sin clientes con ventas registradas.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Segmentacion</h3>
              <p className="mt-1 text-xs text-gray-500">Base de clientes por comportamiento.</p>
            </div>
            <PieChartIcon size={18} className="text-gray-400" />
          </div>
          <div className="space-y-4">
            {status === 'loading' ? <ChartSkeleton /> : customerSegments.map(segment => (
              <div key={segment.segment}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">{segment.segment}</span>
                  <span className="text-gray-500">{segment.count} ({segment.percentage}%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#2a4038] transition-all"
                    style={{ width: `${segment.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <MiniStat label="Unidades vendidas" value={String(analytics.productUnits)} detail="Suma de items vendidos" icon={<Package size={16} />} />
        <MiniStat label="Clientes activos" value={String(analytics.topCustomers.length)} detail="Con al menos un pedido valido" icon={<Users size={16} />} />
        <MiniStat label="Pedidos totales" value={String(orders.length)} detail="Incluye cancelados y fallidos" icon={<ShoppingCart size={16} />} />
        <MiniStat
          label="Riesgo comercial"
          value={analytics.cancellationRate > 12 ? 'Alto' : 'Normal'}
          detail={`${analytics.cancellationRate.toFixed(1)}% de pedidos no generan ingreso`}
          icon={analytics.cancellationRate > 12 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
        />
      </div>
    </div>
  );
}
