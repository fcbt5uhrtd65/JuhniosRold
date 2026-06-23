import { api } from './api';

const SALES_REPORT_PATH = '/analytics/reports/sales/';
const SALES_REPORT_EXPORTS_PATH = `${SALES_REPORT_PATH}exports/`;
const GENERIC_REPORT_EXPORTS_PATH = '/analytics/exports/';

export interface MonthlySales {
  month: string;
  total: number;
  orders: number;
}

export interface CategorySales {
  category: string;
  total: number;
}

export interface TopProduct {
  name: string;
  units: number;
  revenue: number;
}

export interface CustomerSegment {
  segment: 'Nuevos' | 'VIP' | 'Recurrentes' | 'Inactivos';
  count: number;
  percentage: number;
}

export interface SalesReport {
  monthly_sales: MonthlySales[];
  sales_by_category: CategorySales[];
  top_products: TopProduct[];
  customer_segments: CustomerSegment[];
  conversion_rate: number;
}

export async function getSalesReport(): Promise<SalesReport> {
  const res = await api.get<SalesReport>(SALES_REPORT_PATH);
  if (!res.data) {
    throw new Error(res.message || 'No se pudo cargar el reporte de ventas.');
  }
  return res.data;
}

export type SalesReportExportFormat = 'xlsx' | 'pdf';

interface ExportQueuedResponse {
  task_id: string;
  status: 'queued';
}

interface ExportStatusResponse {
  status: 'pending' | 'success' | 'failure';
  url?: string;
  error?: string;
}

export async function requestSalesReportExport(format: SalesReportExportFormat): Promise<string> {
  const res = await api.post<ExportQueuedResponse>(SALES_REPORT_EXPORTS_PATH, { format });
  if (!res.data?.task_id) {
    throw new Error('No se pudo iniciar la exportación.');
  }
  return res.data.task_id;
}

export async function getSalesReportExportStatus(taskId: string): Promise<ExportStatusResponse> {
  const res = await api.get<ExportStatusResponse>(`${SALES_REPORT_EXPORTS_PATH}${taskId}/`);
  if (!res.data) {
    throw new Error('No se pudo consultar el estado de la exportación.');
  }
  return res.data;
}

export type InventoryReportExportFormat = 'xlsx' | 'pdf';

export async function requestGenericReportExport(
  reportType: string,
  format: InventoryReportExportFormat,
  filters: Record<string, unknown> = {},
): Promise<string> {
  const res = await api.post<ExportQueuedResponse>(GENERIC_REPORT_EXPORTS_PATH, {
    report_type: reportType,
    format,
    filters,
  });
  if (!res.data?.task_id) {
    throw new Error('No se pudo iniciar la exportación.');
  }
  return res.data.task_id;
}

export async function getGenericReportExportStatus(taskId: string): Promise<ExportStatusResponse> {
  const res = await api.get<ExportStatusResponse>(`${GENERIC_REPORT_EXPORTS_PATH}${taskId}/`);
  if (!res.data) {
    throw new Error('No se pudo consultar el estado de la exportación.');
  }
  return res.data;
}
