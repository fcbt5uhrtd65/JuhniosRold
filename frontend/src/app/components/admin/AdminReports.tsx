import { useMemo, useState, type ReactNode } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
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
  Area,
  AreaChart,
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
import { Card } from './AdminUI';
import type { Order, Customer } from '../../types/admin';

/* ── paleta ─────────────────────────────────────────────────────────── */
const C = {
  primary: '#1a1a1a',
  green: '#16a34a',
  greenLight: '#dcfce7',
  amber: '#d97706',
  amberLight: '#fef3c7',
  red: '#dc2626',
  redLight: '#fee2e2',
  blue: '#2563eb',
  blueLight: '#dbeafe',
  chart: ['#1a1a1a', '#16a34a', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#64748b', '#0891b2'],
};

const NON_REVENUE: Order['estado'][] = ['cancelado', 'devuelto', 'fallido'];

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', confirmado: 'Confirmado', procesando: 'Procesando',
  empacado: 'Empacado', pagado: 'Pagado', enviado: 'Enviado',
  en_camino: 'En camino', entregado: 'Entregado',
  cancelado: 'Cancelado', devuelto: 'Devuelto', fallido: 'Fallido',
};

const STATUS_COLOR: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmado: 'bg-blue-50 text-blue-700 border-blue-200',
  procesando: 'bg-blue-50 text-blue-700 border-blue-200',
  empacado: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  pagado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  enviado: 'bg-violet-50 text-violet-700 border-violet-200',
  en_camino: 'bg-violet-50 text-violet-700 border-violet-200',
  entregado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelado: 'bg-red-50 text-red-600 border-red-200',
  devuelto: 'bg-red-50 text-red-600 border-red-200',
  fallido: 'bg-red-50 text-red-600 border-red-200',
};

/* ── tipos locales ───────────────────────────────────────────────────── */
type DateRange = 'today' | 'yesterday' | '7d' | '14d' | '30d' | 'month' | 'prev_month' | 'custom';
type TabId = 'overview' | 'products' | 'customers' | 'operational' | 'orders';

interface Filters {
  dateRange: DateRange;
  customFrom: string;
  customTo: string;
  estado: string;
  clientType: string;
  searchQuery: string;
}

/* ── helpers ────────────────────────────────────────────────────────── */
function fmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toLocaleString('es-CO')}`;
}

function fmtN(v: number): string {
  return v.toLocaleString('es-CO');
}

function pct(a: number, b: number): string {
  if (!b) return '0%';
  return `${((a / b) * 100).toFixed(1)}%`;
}

function delta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function getDateBounds(f: Filters): { from: Date; to: Date } {
  const today = new Date();
  switch (f.dateRange) {
    case 'today': return { from: startOfDay(today), to: endOfDay(today) };
    case 'yesterday': { const y = subDays(today, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case '7d': return { from: startOfDay(subDays(today, 6)), to: endOfDay(today) };
    case '14d': return { from: startOfDay(subDays(today, 13)), to: endOfDay(today) };
    case '30d': return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) };
    case 'month': return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'prev_month': { const pm = subMonths(today, 1); return { from: startOfMonth(pm), to: endOfMonth(pm) }; }
    case 'custom': return { from: f.customFrom ? new Date(f.customFrom) : subDays(today, 29), to: f.customTo ? new Date(f.customTo) : today };
    default: return { from: subDays(today, 29), to: today };
  }
}

function inRange(dateStr: string, from: Date, to: Date): boolean {
  const d = new Date(dateStr);
  return d >= from && d <= to;
}

/* ── pequeños componentes UI ─────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, trend, trendUp, color = 'stone',
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  trend?: string; trendUp?: boolean; color?: string;
}) {
  const colorMap: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${colorMap[color] ?? colorMap.stone}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-stone-900 leading-none">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-stone-400">{sub}</p>}
        {trend && (
          <div className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: React.ElementType }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100">
        <Icon className="w-4 h-4 text-stone-600" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-stone-900">{title}</h3>
        <p className="text-[11px] text-stone-400">{subtitle}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-[11px] text-stone-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton({ h = 240 }: { h?: number }) {
  return <div className="animate-pulse rounded-xl bg-stone-50" style={{ height: h }} />;
}

function InsightBadge({ type, text }: { type: 'good' | 'warn' | 'bad' | 'info'; text: string }) {
  const cls = {
    good: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    warn: 'bg-amber-50 border-amber-100 text-amber-800',
    bad: 'bg-red-50 border-red-100 text-red-800',
    info: 'bg-blue-50 border-blue-100 text-blue-800',
  }[type];
  const Icon = { good: CheckCircle2, warn: AlertCircle, bad: AlertTriangle, info: Zap }[type];
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${cls}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" strokeWidth={2} />
      <p className="text-[11px] leading-relaxed font-medium">{text}</p>
    </div>
  );
}

function ProgressBar({ value, max, color = 'bg-stone-800' }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100">
        <Icon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-stone-600">{title}</p>
      <p className="mt-1 text-xs text-stone-400">{sub}</p>
    </div>
  );
}

/* ── Filtros ─────────────────────────────────────────────────────────── */
const DATE_RANGES: { id: DateRange; label: string }[] = [
  { id: 'today', label: 'Hoy' }, { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: 'Últimos 7 días' }, { id: '14d', label: 'Últimos 14 días' },
  { id: '30d', label: 'Últimos 30 días' }, { id: 'month', label: 'Mes actual' },
  { id: 'prev_month', label: 'Mes anterior' }, { id: 'custom', label: 'Personalizado' },
];

const DEFAULT_FILTERS: Filters = {
  dateRange: '30d', customFrom: '', customTo: '', estado: '', clientType: '', searchQuery: '',
};

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const hasActive = filters.estado || filters.clientType || filters.dateRange !== '30d';

  return (
    <div className="mb-6 rounded-2xl border border-stone-200 bg-white">
      {/* barra superior siempre visible */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {/* rango de fechas */}
        <div className="flex flex-wrap gap-1">
          {DATE_RANGES.map(r => (
            <button
              key={r.id}
              onClick={() => onChange({ ...filters, dateRange: r.id })}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                filters.dateRange === r.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasActive && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-50"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
          <button
            onClick={() => setOpen(!open)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${open ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
          >
            <Filter className="w-3 h-3" />
            Filtros
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* fechas personalizadas */}
      {filters.dateRange === 'custom' && (
        <div className="border-t border-stone-100 px-4 py-3 flex items-center gap-3">
          <Calendar className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" strokeWidth={1.5} />
          <input type="date" value={filters.customFrom} onChange={e => onChange({ ...filters, customFrom: e.target.value })}
            className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-400" />
          <span className="text-xs text-stone-400">—</span>
          <input type="date" value={filters.customTo} onChange={e => onChange({ ...filters, customTo: e.target.value })}
            className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-400" />
        </div>
      )}

      {/* filtros expandibles */}
      {open && (
        <div className="border-t border-stone-100 px-4 py-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Estado pedido</label>
            <select value={filters.estado} onChange={e => onChange({ ...filters, estado: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-400 bg-white">
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Tipo cliente</label>
            <select value={filters.clientType} onChange={e => onChange({ ...filters, clientType: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-400 bg-white">
              <option value="">Todos</option>
              <option value="mayorista">Mayorista</option>
              <option value="nuevo">Nuevo</option>
              <option value="recurrente">Recurrente</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Búsqueda</label>
            <input type="text" placeholder="Número de pedido, cliente, producto…" value={filters.searchQuery}
              onChange={e => onChange({ ...filters, searchQuery: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-400 placeholder:text-stone-300" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── hook de analytics ──────────────────────────────────────────────── */
function useAnalytics(orders: Order[], customers: Customer[], filters: Filters) {
  return useMemo(() => {
    const { from, to } = getDateBounds(filters);

    const rangeOrders = orders.filter(o => inRange(o.fecha, from, to));
    const filtered = rangeOrders
      .filter(o => !filters.estado || o.estado === filters.estado)
      .filter(o => {
        if (!filters.clientType) return true;
        const c = customers.find(x => x.id === o.clienteId);
        if (filters.clientType === 'mayorista') return c?.modoCompra === 'WHOLESALE';
        return true;
      });

    const validOrders = filtered.filter(o => !NON_REVENUE.includes(o.estado));
    const cancelledOrders = filtered.filter(o => NON_REVENUE.includes(o.estado));

    const totalRevenue = validOrders.reduce((s, o) => s + o.total, 0);
    const avgTicket = validOrders.length ? totalRevenue / validOrders.length : 0;
    const deliveredCount = filtered.filter(o => o.estado === 'entregado').length;
    const pendingPayment = filtered.filter(o => o.estado === 'pendiente').length;
    const pendingDispatch = filtered.filter(o => ['pagado', 'confirmado'].includes(o.estado)).length;
    const inTransit = filtered.filter(o => ['enviado', 'en_camino'].includes(o.estado)).length;

    /* productos */
    const productMap = new Map<string, { name: string; units: number; revenue: number; orders: number }>();
    validOrders.forEach(o => {
      o.productos.forEach(p => {
        const cur = productMap.get(p.nombre) ?? { name: p.nombre, units: 0, revenue: 0, orders: 0 };
        cur.units += p.cantidad;
        cur.revenue += p.precio * p.cantidad;
        cur.orders += 1;
        productMap.set(p.nombre, cur);
      });
    });
    const productsByRevenue = [...productMap.values()].sort((a, b) => b.revenue - a.revenue);
    const totalUnits = productsByRevenue.reduce((s, p) => s + p.units, 0);
    const topProductShare = totalRevenue > 0 && productsByRevenue[0]
      ? (productsByRevenue[0].revenue / totalRevenue) * 100 : 0;

    /* clientes */
    const clientMap = new Map<string, { name: string; email: string; orders: number; revenue: number; lastOrder: string }>();
    validOrders.forEach(o => {
      const c = customers.find(x => x.id === o.clienteId);
      const name = c?.nombre ?? `Cliente ${o.clienteId.slice(0, 6)}`;
      const email = c?.email ?? '';
      const cur = clientMap.get(o.clienteId) ?? { name, email, orders: 0, revenue: 0, lastOrder: '' };
      cur.orders += 1;
      cur.revenue += o.total;
      if (!cur.lastOrder || o.fecha > cur.lastOrder) cur.lastOrder = o.fecha;
      clientMap.set(o.clienteId, cur);
    });
    const topCustomers = [...clientMap.values()].sort((a, b) => b.revenue - a.revenue);
    const repeatCustomers = topCustomers.filter(c => c.orders > 1);
    const repeatRate = topCustomers.length ? (repeatCustomers.length / topCustomers.length) * 100 : 0;
    const newCustomers = topCustomers.filter(c => c.orders === 1).length;

    /* estados */
    const statusBreakdown = Object.entries(
      filtered.reduce<Record<string, number>>((acc, o) => { acc[o.estado] = (acc[o.estado] ?? 0) + 1; return acc; }, {}),
    ).map(([estado, count], i) => ({ estado: STATUS_LABEL[estado] ?? estado, count, fill: C.chart[i % C.chart.length] }));

    /* ventas diarias */
    const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1;
    const dailySales = Array.from({ length: Math.min(days, 60) }, (_, i) => {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const dayO = validOrders.filter(o => o.fecha.slice(0, 10) === key);
      return { dia: format(d, 'dd/MM'), ventas: dayO.reduce((s, o) => s + o.total, 0), pedidos: dayO.length };
    });

    /* ciudades */
    const cityMap = new Map<string, { city: string; revenue: number; orders: number }>();
    validOrders.forEach(o => {
      const city = (o as Order & { ciudadEnvio?: string }).ciudadEnvio ?? 'Sin ciudad';
      const cur = cityMap.get(city) ?? { city, revenue: 0, orders: 0 };
      cur.revenue += o.total;
      cur.orders += 1;
      cityMap.set(city, cur);
    });
    const topCities = [...cityMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    /* insights automáticos */
    const insightsList: Array<{ type: 'good' | 'warn' | 'bad' | 'info'; text: string }> = [];
    if (cancelledOrders.length / Math.max(filtered.length, 1) > 0.12)
      insightsList.push({ type: 'bad', text: `Tasa de cancelación alta: ${pct(cancelledOrders.length, filtered.length)} de pedidos no generan ingreso.` });
    else
      insightsList.push({ type: 'good', text: `Cancelaciones controladas: solo ${pct(cancelledOrders.length, filtered.length)} de pedidos cancelados/fallidos.` });

    if (topProductShare > 40)
      insightsList.push({ type: 'warn', text: `Alta concentración: "${productsByRevenue[0]?.name}" aporta el ${topProductShare.toFixed(0)}% de los ingresos.` });
    else if (productsByRevenue.length > 0)
      insightsList.push({ type: 'good', text: `Portafolio balanceado: el producto líder no domina excesivamente.` });

    if (pendingDispatch > 3)
      insightsList.push({ type: 'warn', text: `${pendingDispatch} pedidos pagados están pendientes de preparación o despacho.` });

    if (repeatRate > 30)
      insightsList.push({ type: 'good', text: `Recompra saludable: ${repeatRate.toFixed(0)}% de clientes han comprado más de una vez.` });
    else
      insightsList.push({ type: 'info', text: `Nivel de recompra: ${repeatRate.toFixed(0)}%. Oportunidad para fidelizar clientes.` });

    if (avgTicket > 0)
      insightsList.push({ type: 'info', text: `Ticket promedio de ${fmt(avgTicket)} en el periodo seleccionado.` });

    return {
      filtered, validOrders, cancelledOrders,
      totalRevenue, avgTicket, deliveredCount,
      pendingPayment, pendingDispatch, inTransit,
      productsByRevenue, totalUnits, topProductShare,
      topCustomers, repeatCustomers, repeatRate, newCustomers,
      statusBreakdown, dailySales, topCities,
      cancellationRate: filtered.length ? (cancelledOrders.length / filtered.length) * 100 : 0,
      fulfillmentRate: filtered.length ? (deliveredCount / filtered.length) * 100 : 0,
      insightsList,
    };
  }, [orders, customers, filters]);
}

/* ── Tab: Overview ──────────────────────────────────────────────────── */
function TabOverview({ a, report, loadingReport }: {
  a: ReturnType<typeof useAnalytics>;
  report: SalesReport | null;
  loadingReport: boolean;
}) {
  const monthlySalesData = (report?.monthly_sales ?? []).map(m => ({
    mes: m.month.slice(5), ventas: m.total, pedidos: m.orders,
  }));
  const categoryData = (report?.sales_by_category ?? []).map(c => ({ nombre: c.category, ventas: c.total }));

  return (
    <div className="space-y-6">
      {/* KPIs — grid 4 cols */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Ingresos totales" value={fmt(a.totalRevenue)} sub="Pedidos válidos" icon={TrendingUp} color="green" />
        <KpiCard label="Pedidos válidos" value={fmtN(a.validOrders.length)} sub={`de ${fmtN(a.filtered.length)} totales`} icon={ShoppingCart} color="blue" />
        <KpiCard label="Ticket promedio" value={fmt(a.avgTicket)} icon={BarChart3} color="stone" />
        <KpiCard label="Unidades vendidas" value={fmtN(a.totalUnits)} icon={Package} color="violet" />
        <KpiCard label="Clientes activos" value={fmtN(a.topCustomers.length)} sub={`${fmtN(a.newCustomers)} nuevos`} icon={Users} color="amber" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Entregados" value={fmtN(a.deliveredCount)} sub={pct(a.deliveredCount, a.filtered.length)} icon={Check} color="green" />
        <KpiCard label="Pend. pago" value={fmtN(a.pendingPayment)} icon={Clock} color="amber" />
        <KpiCard label="Pend. despacho" value={fmtN(a.pendingDispatch)} icon={Box} color="amber" />
        <KpiCard label="Cancelados/fallidos" value={fmtN(a.cancelledOrders.length)} sub={pct(a.cancelledOrders.length, a.filtered.length)} icon={AlertCircle} color="red" />
      </div>

      {/* Insights */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <SectionHeader title="Resumen ejecutivo" subtitle="Diagnóstico automático del período seleccionado" icon={Zap} />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {a.insightsList.map((ins, i) => <InsightBadge key={i} type={ins.type} text={ins.text} />)}
        </div>
      </div>

      {/* Salud operativa */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <SectionHeader title="Salud operativa" subtitle="Métricas clave de operación" icon={CheckCircle2} />
          <div className="space-y-4">
            {[
              { label: 'Tasa de entrega', value: a.fulfillmentRate, color: 'bg-emerald-500' },
              { label: 'Cancelaciones', value: a.cancellationRate, color: 'bg-red-500' },
              { label: 'Concentración producto líder', value: a.topProductShare, color: 'bg-amber-400' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-stone-600 font-medium">{item.label}</span>
                  <span className="font-bold text-stone-900">{item.value.toFixed(1)}%</span>
                </div>
                <ProgressBar value={item.value} max={100} color={item.color} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <SectionHeader title="Estados actuales" subtitle="Distribución de pedidos" icon={BarChart3} />
          {a.statusBreakdown.length === 0
            ? <EmptyState icon={ShoppingCart} title="Sin pedidos" sub="No hay pedidos en este período" />
            : <div className="space-y-2.5">
              {a.statusBreakdown.map(s => (
                <div key={s.estado} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.fill }} />
                    <span className="text-xs text-stone-600 truncate">{s.estado}</span>
                  </div>
                  <span className="text-xs font-bold text-stone-900 ml-2">{s.count}</span>
                </div>
              ))}
            </div>}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <SectionHeader title="Top clientes" subtitle="Mayor valor acumulado" icon={Star} />
          {a.topCustomers.length === 0
            ? <EmptyState icon={Users} title="Sin clientes" sub="No hay ventas registradas" />
            : <div className="space-y-3">
              {a.topCustomers.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-stone-300 w-4">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-800 truncate">{c.name}</p>
                      <p className="text-[10px] text-stone-400">{c.orders} pedidos</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-900 flex-shrink-0">{fmt(c.revenue)}</span>
                </div>
              ))}
            </div>}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Ventas en el período" subtitle="Ingresos diarios">
          {a.dailySales.length === 0
            ? <EmptyState icon={BarChart3} title="Sin datos" sub="No hay ventas en este rango" />
            : <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={a.dailySales}>
                <defs>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 9 }} stroke="#ccc" />
                <YAxis tick={{ fontSize: 9 }} stroke="#ccc" tickFormatter={v => fmt(v)} />
                <Tooltip formatter={(v: number) => [fmt(v), 'Ventas']} />
                <Area type="monotone" dataKey="ventas" stroke={C.primary} strokeWidth={2} fill="url(#gv)" />
              </AreaChart>
            </ResponsiveContainer>}
        </ChartCard>

        <ChartCard title="Ventas mensuales" subtitle="Histórico desde el backend">
          {loadingReport
            ? <ChartSkeleton h={240} />
            : monthlySalesData.length === 0
              ? <EmptyState icon={BarChart3} title="Sin datos mensuales" sub="El backend aún no retorna histórico" />
              : <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} stroke="#ccc" />
                  <YAxis tick={{ fontSize: 9 }} stroke="#ccc" tickFormatter={v => fmt(v)} />
                  <Tooltip formatter={(v: number, name) => [name === 'ventas' ? fmt(v) : v, name === 'ventas' ? 'Ventas' : 'Pedidos']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="ventas" stroke={C.primary} strokeWidth={2} dot={false} name="Ventas" />
                  <Line type="monotone" dataKey="pedidos" stroke={C.blue} strokeWidth={1.5} dot={false} name="Pedidos" />
                </LineChart>
              </ResponsiveContainer>}
        </ChartCard>

        <ChartCard title="Ventas por categoría" subtitle="Participación por línea comercial">
          {loadingReport
            ? <ChartSkeleton h={240} />
            : categoryData.length === 0
              ? <EmptyState icon={Package} title="Sin categorías" sub="Sin datos del backend aún" />
              : <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="ventas" nameKey="nombre">
                    {categoryData.map((_, i) => <Cell key={i} fill={C.chart[i % C.chart.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>}
        </ChartCard>

        <ChartCard title="Top ciudades" subtitle="Ingresos por ciudad de envío">
          {a.topCities.length === 0
            ? <EmptyState icon={MapPin} title="Sin datos de ciudad" sub="Las órdenes no tienen ciudad asignada" />
            : <ResponsiveContainer width="100%" height={240}>
              <BarChart data={a.topCities} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 9 }} stroke="#ccc" tickFormatter={v => fmt(v)} />
                <YAxis dataKey="city" type="category" tick={{ fontSize: 9 }} width={90} stroke="#ccc" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill={C.primary} radius={[0, 4, 4, 0]} name="Ingresos" />
              </BarChart>
            </ResponsiveContainer>}
        </ChartCard>
      </div>
    </div>
  );
}

/* ── Tab: Productos ─────────────────────────────────────────────────── */
function TabProducts({ a, report, loadingReport }: {
  a: ReturnType<typeof useAnalytics>;
  report: SalesReport | null;
  loadingReport: boolean;
}) {
  const topProductsData = (report?.top_products ?? a.productsByRevenue.slice(0, 10)).map((p, i) => ({
    nombre: `${i + 1}. ${p.name.slice(0, 20)}`,
    unidades: p.units,
    ingresos: p.revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Producto líder" value={a.productsByRevenue[0]?.name?.slice(0, 18) ?? '—'} sub={a.productsByRevenue[0] ? fmt(a.productsByRevenue[0].revenue) : ''} icon={Star} color="amber" />
        <KpiCard label="Unidades vendidas" value={fmtN(a.totalUnits)} sub="Total en el período" icon={Package} color="stone" />
        <KpiCard label="SKUs con ventas" value={fmtN(a.productsByRevenue.length)} icon={Box} color="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Ranking por ingresos" subtitle="Productos más rentables en el período">
          {loadingReport && !a.productsByRevenue.length
            ? <ChartSkeleton />
            : topProductsData.length === 0
              ? <EmptyState icon={Package} title="Sin ventas de productos" sub="No hay datos en el rango seleccionado" />
              : <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topProductsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 9 }} stroke="#ccc" tickFormatter={v => fmt(v)} />
                  <YAxis dataKey="nombre" type="category" tick={{ fontSize: 8 }} width={140} stroke="#ccc" />
                  <Tooltip formatter={(v: number, name) => [name === 'ingresos' ? fmt(v) : v, name === 'ingresos' ? 'Ingresos' : 'Unidades']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ingresos" fill={C.primary} radius={[0, 3, 3, 0]} name="Ingresos" />
                </BarChart>
              </ResponsiveContainer>}
        </ChartCard>

        <ChartCard title="Ranking por unidades" subtitle="Productos con mayor volumen">
          {topProductsData.length === 0
            ? <EmptyState icon={Package} title="Sin datos" sub="No hay ventas en el período" />
            : <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProductsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 9 }} stroke="#ccc" />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 8 }} width={140} stroke="#ccc" />
                <Tooltip />
                <Bar dataKey="unidades" fill={C.green} radius={[0, 3, 3, 0]} name="Unidades" />
              </BarChart>
            </ResponsiveContainer>}
        </ChartCard>
      </div>

      {/* tabla de productos */}
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <SectionHeader title="Detalle por producto" subtitle="Todos los productos con ventas en el período" icon={Package} />
        </div>
        {a.productsByRevenue.length === 0
          ? <EmptyState icon={Package} title="Sin productos vendidos" sub="No hay ventas en este período" />
          : <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {['Producto', 'Unidades', 'Ingresos', '% del total', 'Pedidos'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.productsByRevenue.map((p, i) => (
                  <tr key={p.name} className="border-b border-stone-50 hover:bg-stone-50/50 transition">
                    <td className="px-4 py-3 font-medium text-stone-800">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-300 font-bold w-4">{i + 1}</span>
                        {p.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-stone-700">{fmtN(p.units)}</td>
                    <td className="px-4 py-3 font-bold text-stone-900">{fmt(p.revenue)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={p.revenue} max={a.totalRevenue} color="bg-stone-800" />
                        <span className="text-stone-500 flex-shrink-0 w-10 text-right">{pct(p.revenue, a.totalRevenue)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-500">{p.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}

/* ── Tab: Clientes ──────────────────────────────────────────────────── */
function TabCustomers({ a, report, loadingReport }: {
  a: ReturnType<typeof useAnalytics>;
  report: SalesReport | null;
  loadingReport: boolean;
}) {
  const segments = report?.customer_segments ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Clientes activos" value={fmtN(a.topCustomers.length)} icon={Users} color="blue" />
        <KpiCard label="Clientes nuevos" value={fmtN(a.newCustomers)} icon={Users} color="green" />
        <KpiCard label="Clientes recurrentes" value={fmtN(a.repeatCustomers.length)} icon={RotateCcw} color="violet" />
        <KpiCard label="Tasa de recompra" value={`${a.repeatRate.toFixed(1)}%`} icon={TrendingUp} color="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* segmentación del backend */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <SectionHeader title="Segmentación de clientes" subtitle="Base por comportamiento (datos del backend)" icon={Users} />
          {loadingReport
            ? <ChartSkeleton />
            : segments.length === 0
              ? <EmptyState icon={Users} title="Sin segmentación" sub="El backend no retorna segmentos" />
              : <div className="space-y-4">
                {segments.map(s => (
                  <div key={s.segment}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-stone-700">{s.segment}</span>
                      <span className="text-stone-400">{s.count} clientes · {s.percentage}%</span>
                    </div>
                    <ProgressBar value={s.percentage} max={100} color="bg-stone-800" />
                  </div>
                ))}
              </div>}
        </div>

        {/* clientes por valor */}
        <ChartCard title="Clientes por valor acumulado" subtitle="Top 10 por ingresos generados">
          {a.topCustomers.length === 0
            ? <EmptyState icon={Users} title="Sin clientes" sub="No hay ventas en el período" />
            : <ResponsiveContainer width="100%" height={260}>
              <BarChart data={a.topCustomers.slice(0, 10).map(c => ({ nombre: c.name.split(' ')[0], ingresos: c.revenue }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 9 }} stroke="#ccc" tickFormatter={v => fmt(v)} />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 9 }} width={80} stroke="#ccc" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="ingresos" fill={C.primary} radius={[0, 4, 4, 0]} name="Ingresos" />
              </BarChart>
            </ResponsiveContainer>}
        </ChartCard>
      </div>

      {/* tabla clientes */}
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <SectionHeader title="Detalle por cliente" subtitle="Clientes con compras en el período" icon={Users} />
        </div>
        {a.topCustomers.length === 0
          ? <EmptyState icon={Users} title="Sin clientes activos" sub="No hay ventas en este período" />
          : <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {['#', 'Cliente', 'Email', 'Pedidos', 'Ingresos', 'Última compra', 'Tipo'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.topCustomers.map((c, i) => (
                  <tr key={c.name + i} className="border-b border-stone-50 hover:bg-stone-50/50 transition">
                    <td className="px-4 py-3 text-stone-300 font-bold">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-stone-800">{c.name}</td>
                    <td className="px-4 py-3 text-stone-400">{c.email || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-stone-700">{c.orders}</td>
                    <td className="px-4 py-3 font-bold text-stone-900">{fmt(c.revenue)}</td>
                    <td className="px-4 py-3 text-stone-400">{c.lastOrder ? format(new Date(c.lastOrder), 'dd/MM/yyyy') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${c.orders > 1 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>
                        {c.orders > 1 ? 'Recurrente' : 'Nuevo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}

/* ── Tab: Salud Operacional ─────────────────────────────────────────── */
function TabOperational({ a }: { a: ReturnType<typeof useAnalytics> }) {
  const opMetrics = [
    { label: 'Pedidos pend. de pago', value: a.pendingPayment, icon: Clock, color: 'amber', action: 'Revisar y recordar al cliente' },
    { label: 'Pagados sin preparar', value: a.pendingDispatch, icon: Box, color: 'amber', action: 'Iniciar preparación' },
    { label: 'Enviados en tránsito', value: a.inTransit, icon: TrendingUp, color: 'blue', action: 'Monitorear entregas' },
    { label: 'Cancelados / fallidos', value: a.cancelledOrders.length, icon: AlertCircle, color: 'red', action: 'Analizar causas' },
    { label: 'Entregados exitosos', value: a.deliveredCount, icon: CheckCircle2, color: 'green', action: '' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {opMetrics.map(m => (
          <div key={m.label} className={`rounded-2xl border p-4 ${m.color === 'red' && m.value > 0 ? 'border-red-200 bg-red-50' : m.color === 'amber' && m.value > 3 ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{m.label}</p>
            </div>
            <p className={`text-2xl font-bold ${m.color === 'red' && m.value > 0 ? 'text-red-700' : m.color === 'amber' && m.value > 3 ? 'text-amber-700' : m.color === 'green' ? 'text-emerald-700' : 'text-stone-900'}`}>
              {fmtN(m.value)}
            </p>
            {m.action && m.value > 0 && (
              <p className="mt-1 text-[10px] text-stone-400">{m.action}</p>
            )}
          </div>
        ))}
      </div>

      {/* Alertas operativas */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <SectionHeader title="Alertas operativas" subtitle="Situaciones que requieren atención inmediata" icon={AlertTriangle} />
        <div className="space-y-2">
          {a.pendingPayment > 5 && <InsightBadge type="warn" text={`${a.pendingPayment} pedidos llevan más tiempo pendientes de pago. Considera enviar recordatorio.`} />}
          {a.pendingDispatch > 3 && <InsightBadge type="warn" text={`${a.pendingDispatch} pedidos pagados no han sido despachados. Revisar capacidad operativa.`} />}
          {a.cancellationRate > 15 && <InsightBadge type="bad" text={`Tasa de cancelación crítica: ${a.cancellationRate.toFixed(1)}%. Auditar proceso de pago y stock.`} />}
          {a.cancelledOrders.length > 0 && a.cancellationRate <= 15 && <InsightBadge type="info" text={`${a.cancelledOrders.length} pedidos cancelados/fallidos. Tasa dentro del rango normal.`} />}
          {a.fulfillmentRate > 80 && <InsightBadge type="good" text={`Tasa de entrega excelente: ${a.fulfillmentRate.toFixed(1)}% de pedidos entregados exitosamente.`} />}
          {a.pendingPayment === 0 && a.pendingDispatch === 0 && <InsightBadge type="good" text="Sin pedidos pendientes de pago o despacho. Operación al día." />}
          {a.filtered.length === 0 && <InsightBadge type="info" text="No hay pedidos en el rango de fechas seleccionado." />}
        </div>
      </div>

      {/* tabla operacional */}
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <SectionHeader title="Pedidos que necesitan acción" subtitle="Pendientes, pagados sin despachar o en problema" icon={AlertCircle} />
        </div>
        {(() => {
          const actionOrders = a.filtered.filter(o => ['pendiente', 'confirmado', 'pagado', 'cancelado', 'fallido'].includes(o.estado));
          if (actionOrders.length === 0)
            return <EmptyState icon={CheckCircle2} title="Todo en orden" sub="No hay pedidos que requieran acción inmediata" />;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr>
                    {['Pedido', 'Fecha', 'Total', 'Estado', 'Acción requerida'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actionOrders.slice(0, 20).map(o => (
                    <tr key={o.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-stone-800">#{o.numero ?? o.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-4 py-3 text-stone-500">{format(new Date(o.fecha), 'dd/MM/yy HH:mm')}</td>
                      <td className="px-4 py-3 font-bold text-stone-900">{fmt(o.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_COLOR[o.estado] ?? 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                          {STATUS_LABEL[o.estado] ?? o.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-400">
                        {o.estado === 'pendiente' && 'Esperar pago o contactar cliente'}
                        {(o.estado === 'pagado' || o.estado === 'confirmado') && 'Iniciar preparación →'}
                        {o.estado === 'cancelado' && 'Registrar motivo'}
                        {o.estado === 'fallido' && 'Revisar pasarela de pago'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Tab: Tabla de Pedidos ──────────────────────────────────────────── */
function TabOrders({ a, filters, onFilterChange }: {
  a: ReturnType<typeof useAnalytics>;
  filters: Filters;
  onFilterChange: (f: Filters) => void;
}) {
  const [sortField, setSortField] = useState<'fecha' | 'total'>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const sorted = useMemo(() => {
    const q = filters.searchQuery.toLowerCase();
    return [...a.filtered]
      .filter(o => {
        if (!q) return true;
        return (
          o.id.toLowerCase().includes(q) ||
          (o.numero ?? '').toLowerCase().includes(q) ||
          o.productos.some(p => p.nombre.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const v = sortField === 'fecha'
          ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
          : a.total - b.total;
        return sortDir === 'asc' ? v : -v;
      });
  }, [a.filtered, filters.searchQuery, sortField, sortDir]);

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const pageOrders = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function toggleSort(f: 'fecha' | 'total') {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
    setPage(1);
  }

  const SortIcon = ({ f }: { f: 'fecha' | 'total' }) => sortField === f
    ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-stone-400">{fmtN(sorted.length)} pedidos encontrados</p>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, '…', pages].filter((p, i, arr) => arr.indexOf(p) === i).map((p, i) =>
            p === '…'
              ? <span key="e" className="px-1 text-stone-300 text-xs">…</span>
              : <button key={i} onClick={() => setPage(Number(p))}
                className={`h-7 w-7 rounded-lg text-[11px] font-semibold transition ${page === p ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>
                {p}
              </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        {sorted.length === 0
          ? <EmptyState icon={ShoppingCart} title="Sin pedidos" sub="Ajusta los filtros para ver resultados" />
          : <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[800px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px]">Pedido</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px] cursor-pointer select-none" onClick={() => toggleSort('fecha')}>
                    <span className="flex items-center gap-1">Fecha <SortIcon f="fecha" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px]">Productos</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px] cursor-pointer select-none" onClick={() => toggleSort('total')}>
                    <span className="flex items-center gap-1">Total <SortIcon f="total" /></span>
                  </th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px]">Estado</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-stone-400 text-[10px]">Pago</th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map(o => (
                  <tr key={o.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-stone-800">
                      #{o.numero ?? o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                      {format(new Date(o.fecha), 'dd/MM/yy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-stone-600 max-w-[200px]">
                      <p className="truncate">{o.productos.map(p => `${p.nombre} ×${p.cantidad}`).join(', ')}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-stone-900 whitespace-nowrap">{fmt(o.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_COLOR[o.estado] ?? 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                        {STATUS_LABEL[o.estado] ?? o.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-400 capitalize">{(o as Order & { metodoPago?: string }).metodoPago ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>

      {/* paginación inferior */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-400">Página {page} de {pages}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-stone-500 border border-stone-200 hover:bg-stone-50 disabled:opacity-30">
              ←
            </button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-stone-500 border border-stone-200 hover:bg-stone-50 disabled:opacity-30">
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Componente principal ───────────────────────────────────────────── */
export function AdminReports() {
  const { orders, customers } = useAdmin();
  const toast = useToast();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const analytics = useAnalytics(orders, customers, filters);

  const loadReport = () => {
    setLoadingReport(true);
    setReportError('');
    getSalesReport()
      .then(d => { setReport(d); setLoadingReport(false); })
      .catch(e => { setReportError(e instanceof Error ? e.message : 'Error'); setLoadingReport(false); });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { loadReport(); }, []);

  const handleExport = async (format: SalesReportExportFormat) => {
    setIsExporting(true);
    toast.info('Generando exportación…');
    try {
      const taskId = await requestSalesReportExport(format);
      const url = await pollExportStatus(taskId, getSalesReportExportStatus);
      window.open(resolveBackendUrl(url), '_blank');
      toast.success('Exportación lista.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al exportar');
    } finally {
      setIsExporting(false);
    }
  };

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'products', label: 'Productos', icon: Package },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'operational', label: 'Operacional', icon: AlertCircle },
    { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
  ];

  return (
    <div className="space-y-0">

      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-stone-600">
            <BarChart3 className="w-3 h-3" /> Inteligencia comercial
          </div>
          <h2 className="text-xl font-bold text-stone-900">Reportes</h2>
          <p className="mt-0.5 text-xs text-stone-400">Ventas · Pedidos · Clientes · Productos · Operación</p>
        </div>
        <div className="flex items-center gap-2">
          {reportError && (
            <span className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" /> {reportError}
            </span>
          )}
          <button onClick={loadReport}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-600 transition hover:bg-stone-50">
            {loadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Actualizar
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button disabled={isExporting}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-stone-900 px-4 text-xs font-semibold text-white transition hover:opacity-80 disabled:opacity-40">
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
                Exportar
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handleExport('pdf')}>
                <FileText className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} /> PDF ejecutivo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport('xlsx')}>
                <FileSpreadsheet className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} /> Excel editable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Filtros ── */}
      <FilterBar filters={filters} onChange={f => { setFilters(f); }} />

      {/* ── Tabs ── */}
      <div className="mb-6 flex gap-1 border-b border-stone-200 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition -mb-px ${
                activeTab === tab.id
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}>
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Contenido por tab ── */}
      {activeTab === 'overview' && <TabOverview a={analytics} report={report} loadingReport={loadingReport} />}
      {activeTab === 'products' && <TabProducts a={analytics} report={report} loadingReport={loadingReport} />}
      {activeTab === 'customers' && <TabCustomers a={analytics} report={report} loadingReport={loadingReport} />}
      {activeTab === 'operational' && <TabOperational a={analytics} />}
      {activeTab === 'orders' && <TabOrders a={analytics} filters={filters} onFilterChange={setFilters} />}
    </div>
  );
}
