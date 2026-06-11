import { api } from './api';

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
