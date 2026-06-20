import { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  Download, TrendingUp, DollarSign, ShoppingCart, Users, AlertTriangle,
  FileSpreadsheet, FileText,
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  getSalesReport, requestSalesReportExport, getSalesReportExportStatus,
  type SalesReport, type SalesReportExportFormat,
} from '../../services/reports.service';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu';
import { pollExportStatus } from '../../utils/pollExportStatus';
import { resolveBackendUrl } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Card, KpiCard } from './AdminUI';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function formatMonth(month: string): string {
  const [, monthNumber] = month.split('-');
  return MONTH_LABELS[monthNumber] ?? month;
}

const COLORS = ['#2a4038', '#3d5c4e', '#5a8a73', '#8ab5a0', '#b8d4c6', '#d4e6dc', '#e8f1ec'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </Card>
  );
}

function ChartSkeleton() {
  return <div className="h-[250px] animate-pulse bg-gray-50 rounded-xl" />;
}

export function AdminReports() {
  const { orders } = useAdmin();
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
    toast.info('Generando exportación, esto puede tardar unos segundos...');
    try {
      const taskId = await requestSalesReportExport(format);
      const relativeUrl = await pollExportStatus(taskId, getSalesReportExportStatus);
      window.open(resolveBackendUrl(relativeUrl), '_blank');
      toast.success('Exportación lista.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el reporte');
    } finally {
      setIsExporting(false);
    }
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reportes</h2>
          <p className="text-xs text-gray-500 mt-0.5">Análisis y métricas de negocio</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={14} />
              Exportar
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => handleExport('pdf')}>
              <FileText className="w-4 h-4 mr-2" strokeWidth={1} />
              Exportar a PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleExport('xlsx')}>
              <FileSpreadsheet className="w-4 h-4 mr-2" strokeWidth={1} />
              Exportar a Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Ingresos Totales"
          value={`$${(totalVentas / 1000).toFixed(0)}k`}
          icon={DollarSign}
          color="text-[#2a4038] bg-[#2a4038]/10"
          trend={salesDelta !== null ? `${salesDelta >= 0 ? '+' : ''}${salesDelta.toFixed(0)}% vs mes ant.` : undefined}
        />
        <KpiCard
          label="Pedidos"
          value={String(orders.length)}
          icon={ShoppingCart}
          color="text-blue-600 bg-blue-50"
          trend={ordersDelta !== null ? `${ordersDelta >= 0 ? '+' : ''}${ordersDelta.toFixed(0)}% vs mes ant.` : undefined}
        />
        <KpiCard label="Ticket Promedio" value={`$${(promedioVenta / 1000).toFixed(1)}k`} icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Tasa Conversión" value={`${tasaConversion}%`} icon={Users} color="text-purple-600 bg-purple-50" />
      </div>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle size={15} />
            {errorMessage}
          </div>
          <button
            onClick={loadReport}
            className="px-3 py-1.5 border border-red-200 rounded-lg text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <ChartCard title={`Ventas Mensuales (últimos ${monthlySales.length || 6} meses)`}>
          {status === 'loading' ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlySalesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis tick={{ fontSize: 10 }} stroke="#999" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="ventas" stroke="#2a4038" strokeWidth={2} name="Ventas ($)" dot={false} />
                <Line type="monotone" dataKey="pedidos" stroke="#8ab5a0" strokeWidth={2} name="Pedidos" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ventas por Categoría">
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

        <ChartCard title="Top 5 Productos">
          {status === 'loading' ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProductsChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#999" />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 9 }} width={120} stroke="#999" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="unidades" fill="#2a4038" name="Unidades" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Segmentación de Clientes">
          {status === 'loading' ? <ChartSkeleton /> : (
            <div className="space-y-4">
              {customerSegments.map(segment => (
                <div key={segment.segment}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">{segment.segment}</span>
                    <span className="text-xs text-gray-400">{segment.count} ({segment.percentage}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-[#2a4038] rounded-full transition-all"
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
