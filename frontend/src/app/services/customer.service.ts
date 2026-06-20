// ============================================================
// Customer Profile Service — Juhnios Rold Frontend
// "Mi perfil": datos del cliente registrados en /customers/me/
// ============================================================

import { api } from './api';

export interface MyCustomerProfile {
  id: string;
  document_type: string;
  document_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  reference: string;
}

export interface UpdateMyCustomerProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  reference?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export async function getMyCustomerProfile(): Promise<MyCustomerProfile> {
  const res = await api.get<MyCustomerProfile>('/customers/me/');
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function updateMyCustomerProfile(
  payload: UpdateMyCustomerProfilePayload,
): Promise<MyCustomerProfile> {
  const res = await api.patch<MyCustomerProfile>('/customers/me/', payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}
