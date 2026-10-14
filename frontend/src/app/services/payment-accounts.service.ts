// ============================================================
// Payment Accounts (Cuentas de cobro) Service — Juhnios Rold Frontend
// ============================================================

import { api } from './api';
import type { PaymentAccountDoc } from '../utils/documentText';

const PATH = '/finance/payment-accounts/';

export type PaymentAccount = PaymentAccountDoc & {
  id: string;
  has_signature?: boolean;
  created_at?: string;
};

export interface PaymentAccountFilters {
  name?: string;
  id_number?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface PaymentAccountPage {
  results: PaymentAccount[];
  count: number;
  page_size: number;
  total_pages: number;
}

type RawAccount = Omit<PaymentAccount, 'number' | 'amount' | 'monthly_value'> & {
  id_number: number;
  amount: string | number;
  monthly_value: string | number | null;
};

function normalize(raw: RawAccount): PaymentAccount {
  const text = (v: unknown) => (v == null ? '' : String(v));
  return {
    ...raw,
    number: raw.id_number,
    amount: Number(raw.amount),
    monthly_value: raw.monthly_value == null ? null : Number(raw.monthly_value),
    period_start: text(raw.period_start),
    period_end: text(raw.period_end),
    requisition_date: text(raw.requisition_date),
    signature: text(raw.signature),
  };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export async function getPaymentAccounts(filters: PaymentAccountFilters = {}): Promise<PaymentAccountPage> {
  const res = await api.get<{
    results: RawAccount[];
    count: number;
    page_size?: number;
    total_pages?: number;
  }>(`${PATH}${buildQuery({ ...filters })}`);
  const data = res.data;
  const results = (data?.results ?? []).map(normalize);
  return {
    results,
    count: data?.count ?? results.length,
    page_size: data?.page_size ?? filters.page_size ?? 10,
    total_pages: data?.total_pages ?? 1,
  };
}

export async function getPaymentAccount(id: string): Promise<PaymentAccount> {
  const res = await api.get<RawAccount>(`${PATH}${id}/`);
  return normalize(res.data as RawAccount);
}

export type PaymentAccountInput = Omit<PaymentAccountDoc, 'number'>;

export async function createPaymentAccount(input: PaymentAccountInput): Promise<PaymentAccount> {
  const body = {
    ...input,
    // Fechas opcionales vacías → null para que el backend no las rechace.
    period_start: input.period_start || null,
    period_end: input.period_end || null,
    requisition_date: input.requisition_date || null,
  };
  const res = await api.post<RawAccount>(PATH, body);
  return normalize(res.data as RawAccount);
}

export async function deletePaymentAccount(id: string): Promise<void> {
  await api.delete(`${PATH}${id}/`);
}

export async function getNextPaymentAccountNumber(): Promise<number> {
  const res = await api.get<{ next_number: number }>(`${PATH}next-number/`);
  return res.data?.next_number ?? 1;
}
