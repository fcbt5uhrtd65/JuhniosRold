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
  company_id_type?: string;
  company_id_type_other?: string;
  company_id_number?: string;
  company_name?: string;
  business_type?: string;
  is_international_distributor?: boolean;
  company_phone?: string;
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

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

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

export async function updateCustomer(
  id: string,
  payload: UpdateCustomerPayload,
): Promise<BackendCustomer> {
  const res = await api.patch<BackendCustomer>(`/customers/${id}/`, payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`/customers/${id}/`);
}
