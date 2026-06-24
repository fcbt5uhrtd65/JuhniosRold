import { api } from './api';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BackendCustomer {
  id: string;
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  purchase_mode?: 'RETAIL' | 'WHOLESALE';
  wholesale_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_compras?: number;
  ultima_compra?: string | null;
}

export interface CreateCustomerPayload {
  document_type?: string;
  document_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  purchase_mode?: 'RETAIL' | 'WHOLESALE';
  is_active?: boolean;
}

export async function getCustomers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ data: BackendCustomer[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('page_size', String(params.limit));
  if (params?.search) query.set('search', params.search);

  const endpoint = `/customers/${query.toString() ? `?${query}` : ''}`;
  const res = await api.get<PaginatedResponse<BackendCustomer>>(endpoint);
  if (!res.data) throw new Error(res.message);
  return { data: res.data.results, total: res.data.count };
}

export async function createCustomer(
  payload: CreateCustomerPayload,
): Promise<BackendCustomer> {
  const res = await api.post<BackendCustomer>('/customers/', payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}
