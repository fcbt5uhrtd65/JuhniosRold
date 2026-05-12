// ============================================================
// Orders Service — Juhnios Rold Frontend
// ============================================================

import { api } from './api';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
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

// ---- List orders ----
export async function getOrders(params?: { page?: number; limit?: number }): Promise<{
  data: Order[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const endpoint = `/orders${query.toString() ? `?${query}` : ''}`;
  const res = await api.get<{ data: Order[]; total: number; page: number; totalPages: number }>(endpoint);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Get order by ID ----
export async function getOrderById(id: string): Promise<Order> {
  const res = await api.get<Order>(`/orders/${id}`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Get order stats (admin) ----
export async function getOrderStats(): Promise<OrderStats> {
  const res = await api.get<OrderStats>('/orders/stats');
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Create order ----
export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await api.post<Order>('/orders', payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Update order status (admin) ----
export async function updateOrderStatus(
  id: string,
  payload: UpdateOrderStatusPayload,
): Promise<Order> {
  const res = await api.patch<Order>(`/orders/${id}/status`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Cancel order ----
export async function cancelOrder(id: string): Promise<Order> {
  const res = await api.post<Order>(`/orders/${id}/cancel`, {});
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Status label helpers ----
export function getOrderStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    processing: 'Procesando',
    shipped: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
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
