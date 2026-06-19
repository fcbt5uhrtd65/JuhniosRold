import { api } from './api';

const SALES_REPORT_PATH = '/analytics/reports/sales/';

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
