import { api, API_BASE_URL, getAccessToken } from './api';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type AdminPaymentStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED' | 'EXPIRED';
export type AdminPaymentProvider = 'MOCK' | 'WOMPI';

interface BackendAdminPayment {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  provider: AdminPaymentProvider;
  reference: string;
  amount_in_cents: number;
  currency: string;
  status: AdminPaymentStatus;
  payment_method: string;
  provider_transaction_id: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminPayment {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  provider: AdminPaymentProvider;
  reference: string;
  amount: number;
  currency: string;
  status: AdminPaymentStatus;
  paymentMethod: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

function normalizeAdminPayment(payment: BackendAdminPayment): AdminPayment {
  return {
    id: payment.id,
    orderId: payment.order_id,
    orderNumber: payment.order_number,
    customerName: payment.customer_name,
    provider: payment.provider,
    reference: payment.reference,
    amount: payment.amount_in_cents / 100,
    currency: payment.currency,
    status: payment.status,
    paymentMethod: payment.payment_method,
    invoiceId: payment.invoice_id,
    invoiceNumber: payment.invoice_number,
    createdAt: payment.created_at,
  };
}

export interface OrderInvoice {
  id: string;
  number: string;
  orderId: string;
}

export async function getInvoiceByOrder(orderId: string): Promise<OrderInvoice | null> {
  const token = getAccessToken();
  if (!token) return null;
  // Filtrar facturas directamente por order UUID — requiere filterset_fields = ("order",) en el backend
  const response = await fetch(`${API_BASE_URL}/finance/invoices/?order=${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const results: Array<{ id: string; number: string; order: string }> = data.results ?? data;
  const match = results[0];
  if (!match) return null;
  return { id: match.id, number: match.number, orderId: match.order };
}

export async function openInvoicePdf(invoiceId: string): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
  }
  const response = await fetch(`${API_BASE_URL}/finance/invoices/${invoiceId}/pdf/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('No se pudo obtener la factura.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function getAdminPayments(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AdminPaymentStatus;
}): Promise<{ data: AdminPayment[]; total: number; totalPages: number; page: number }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  query.set('page_size', String(params?.pageSize ?? 20));
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);

  const res = await api.get<PaginatedResponse<BackendAdminPayment>>(`/commerce/payments/?${query}`);
  if (!res.data) throw new Error(res.message || 'No se pudieron cargar los pagos.');

  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  return {
    data: res.data.results.map(normalizeAdminPayment),
    total: res.data.count,
    totalPages: Math.max(1, Math.ceil(res.data.count / pageSize)),
    page,
  };
}

export interface PaymentStartData {
  provider: 'mock' | 'wompi';
  payment_id: string;
  requires_redirect: boolean;
  checkout_url: string;
  reference: string;
  amount_in_cents: number;
  currency: string;
  public_key: string;
  integrity_signature: string;
  redirect_url: string;
}

export interface PaymentStatus {
  order_id: string;
  order_status: string;
  payment_status: string | null;
  provider: string;
  payment_method: string;
  transaction_id: string;
  invoice_number: string;
}

export async function initiatePayment(orderId: string): Promise<PaymentStartData> {
  const response = await api.post<PaymentStartData>(
    '/commerce/payments/start/',
    { order_id: orderId },
  );
  if (!response.data) throw new Error(response.message);
  return response.data;
}

export async function resolveMockPayment(
  paymentId: string,
  outcome: 'approved' | 'declined',
): Promise<{
  order_id: string;
  payment_status: string;
  order_status: string;
  invoice_number: string;
}> {
  const response = await api.post<{
    order_id: string;
    payment_status: string;
    order_status: string;
    invoice_number: string;
  }>(`/commerce/payments/mock/${paymentId}/resolve/`, { outcome });
  if (!response.data) throw new Error(response.message);
  return response.data;
}

export async function getPaymentStatus(
  orderId: string,
  signal?: AbortSignal,
): Promise<PaymentStatus> {
  const response = await api.get<PaymentStatus>(
    `/commerce/payments/status/${orderId}/`,
    signal,
  );
  if (!response.data) throw new Error(response.message);
  return response.data;
}
