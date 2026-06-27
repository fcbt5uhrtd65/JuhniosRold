// ============================================================
// Orders Service — Juhnios Rold Frontend
// ============================================================

import { api } from './api';

const ORDERS_PATH = '/commerce/orders/';

export type OrderStatus =
  | 'pending'
  | 'payment_pending'
  | 'paid'
  | 'failed'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface ShippingAddress {
  full_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  department: string;
  postal_code?: string;
  phone: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  shipping_address: ShippingAddress;
  payment_method: string;
  payment_status: PaymentStatus;
  payment_reference?: string;
  notes?: string;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateOrderPayload {
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
  shipping_address: ShippingAddress;
  payment_method: string;
  notes?: string;
}

export interface UpdateOrderStatusPayload {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  payment_reference?: string;
}

export interface OrderStats {
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  orders_by_status: Record<OrderStatus, number>;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface BackendOrderItem {
  id: string;
  order: string;
  variant: string;
  product_name: string;
  sku: string;
  quantity: string | number;
  unit_price: string | number;
  subtotal: string | number;
  created_at: string;
}

interface BackendPayment {
  id: string;
  provider: 'MOCK' | 'WOMPI';
  reference: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED' | 'EXPIRED';
  payment_method: string;
  provider_transaction_id: string | null;
  created_at: string;
}

interface BackendShippingAddressDetails {
  full_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  department?: string;
  postal_code?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface BackendOrder {
  id: string;
  number: string;
  customer: string;
  status: string;
  subtotal: string | number;
  shipping_cost: string | number;
  total: string | number;
  shipping_address: string;
  shipping_address_details: BackendShippingAddressDetails | null;
  tracking_number: string;
  payment_reference: string;
  items: BackendOrderItem[];
  payments: BackendPayment[];
  created_at: string;
  updated_at: string;
}

function parseNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(status: string): OrderStatus {
  const normalized = status.toLowerCase();
  if (
    normalized === 'pending' ||
    normalized === 'payment_pending' ||
    normalized === 'paid' ||
    normalized === 'failed' ||
    normalized === 'confirmed' ||
    normalized === 'processing' ||
    normalized === 'packed' ||
    normalized === 'shipped' ||
    normalized === 'in_transit' ||
    normalized === 'delivered' ||
    normalized === 'cancelled' ||
    normalized === 'returned'
  ) {
    return normalized;
  }
  return 'pending';
}

function normalizeOrder(order: BackendOrder): Order {
  const latestPayment = [...(order.payments ?? [])].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )[0];
  const paymentStatus: PaymentStatus =
    latestPayment?.status === 'APPROVED'
      ? 'paid'
      : latestPayment?.status === 'PENDING'
        ? 'pending'
        : latestPayment
          ? 'failed'
          : 'pending';

  return {
    id: order.id,
    order_number: order.number,
    user_id: order.customer,
    status: normalizeStatus(order.status),
    total_amount: parseNumber(order.total),
    subtotal: parseNumber(order.subtotal),
    shipping_cost: parseNumber(order.shipping_cost),
    discount_amount: 0,
    shipping_address: (() => {
      const d = order.shipping_address_details;
      if (d) {
        return {
          full_name: d.full_name ?? '',
          address_line1: d.address_line1 ?? '',
          address_line2: d.address_line2,
          city: d.city ?? '',
          department: d.department ?? '',
          postal_code: d.postal_code,
          phone: d.phone ?? '',
          country: d.country || 'CO',
          latitude: d.latitude ?? null,
          longitude: d.longitude ?? null,
        };
      }
      // fallback: try to parse shipping_address as JSON
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(order.shipping_address); } catch { /* raw string */ }
      return {
        full_name: (parsed.full_name as string) ?? '',
        address_line1: (parsed.address_line1 as string) ?? order.shipping_address ?? '',
        address_line2: parsed.address_line2 as string | undefined,
        city: (parsed.city as string) ?? '',
        department: (parsed.department as string) ?? '',
        postal_code: parsed.postal_code as string | undefined,
        phone: (parsed.phone as string) ?? '',
        country: (parsed.country as string) || 'CO',
        latitude: (parsed.latitude as number) ?? null,
        longitude: (parsed.longitude as number) ?? null,
      };
    })(),
    payment_method: latestPayment?.provider.toLowerCase() ?? '',
    payment_status: paymentStatus,
    payment_reference: latestPayment?.reference || order.payment_reference,
    items: order.items.map(item => ({
      id: item.id,
      order_id: item.order,
      product_id: item.variant,
      product_name: item.product_name,
      product_sku: item.sku,
      quantity: parseNumber(item.quantity),
      unit_price: parseNumber(item.unit_price),
      subtotal: parseNumber(item.subtotal),
      created_at: item.created_at,
    })),
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

// ---- List orders ----
export async function getOrders(params?: { page?: number; limit?: number }): Promise<{
  data: Order[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('page_size', String(params.limit));

  const endpoint = `${ORDERS_PATH}${query.toString() ? `?${query}` : ''}`;
  const res = await api.get<PaginatedResponse<BackendOrder>>(endpoint);
  if (!res.data) throw new Error(res.message);

  const page = params?.page ?? 1;
  const limit = params?.limit ?? Math.max(res.data.results.length, 1);
  return {
    data: res.data.results.map(normalizeOrder),
    total: res.data.count,
    page,
    totalPages: Math.max(1, Math.ceil(res.data.count / limit)),
  };
}

// ---- Get order by ID ----
export async function getOrderById(id: string): Promise<Order> {
  const res = await api.get<BackendOrder>(`${ORDERS_PATH}${id}/`);
  if (res.data) return normalizeOrder(res.data);
  throw new Error(res.message);
}

// ---- Get order stats (admin) ----
export async function getOrderStats(): Promise<OrderStats> {
  const result = await getOrders({ limit: 100 });
  const ordersByStatus = {
    pending: 0,
    payment_pending: 0,
    paid: 0,
    failed: 0,
    confirmed: 0,
    processing: 0,
    packed: 0,
    shipped: 0,
    in_transit: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,
    refunded: 0,
  };

  result.data.forEach(order => {
    ordersByStatus[order.status] += 1;
  });

  return {
    total_orders: result.total,
    pending_orders: ordersByStatus.pending,
    total_revenue: result.data.reduce((total, order) => total + order.total_amount, 0),
    orders_by_status: ordersByStatus,
  };
}

// ---- Create order ----
export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await api.post<BackendOrder>(ORDERS_PATH, payload);
  if (res.data) return normalizeOrder(res.data);
  throw new Error(res.message);
}

// ---- Update order status (admin) ----
export async function updateOrderStatus(
  id: string,
  payload: UpdateOrderStatusPayload,
): Promise<Order> {
  const res = await api.patch<BackendOrder>(`${ORDERS_PATH}${id}/`, {
    ...(payload.status ? { status: payload.status.toUpperCase() } : {}),
    ...(payload.payment_reference !== undefined
      ? { payment_reference: payload.payment_reference }
      : {}),
  });
  if (res.data) return normalizeOrder(res.data);
  throw new Error(res.message);
}

// ---- Cancel order ----
export async function cancelOrder(id: string): Promise<Order> {
  const res = await api.post<BackendOrder>(`${ORDERS_PATH}${id}/cancel/`, {});
  if (res.data) return normalizeOrder(res.data);
  throw new Error(res.message);
}

// ---- Status label helpers ----
export function getOrderStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'Pendiente',
    payment_pending: 'Pendiente de pago',
    paid: 'Pagado',
    failed: 'Pago rechazado',
    confirmed: 'Confirmado',
    processing: 'Procesando',
    packed: 'Empacado',
    shipped: 'En camino',
    in_transit: 'En tránsito',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    returned: 'Devuelto',
    refunded: 'Reembolsado',
  };
  return labels[status] ?? status;
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: 'Pendiente',
    paid: 'Pagado',
    failed: 'Fallido',
    refunded: 'Reembolsado',
  };
  return labels[status] ?? status;
}
