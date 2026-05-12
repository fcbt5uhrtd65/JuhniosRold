// ============================================================
// PRO Service — Juhnios Rold Frontend
// Handles: PRO access requests, approval, benefits
// ============================================================

import { api } from './api';

export type ProStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type BusinessType =
  | 'salon'
  | 'stylist'
  | 'distributor'
  | 'spa'
  | 'barbershop'
  | 'other';

export interface ProProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_type: BusinessType;
  nit?: string;
  city: string;
  department: string;
  website_url?: string;
  social_media?: Record<string, string>;
  status: ProStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  discount_percentage: number;
  priority_shipping: boolean;
  early_access: boolean;
  benefits: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProBenefits {
  discount_percentage: number;
  priority_shipping: boolean;
  early_access: boolean;
  dedicated_support: boolean;
}

export interface RequestProPayload {
  business_name: string;
  business_type: BusinessType;
  nit?: string;
  city: string;
  department: string;
  website_url?: string;
  social_media?: Record<string, string>;
}

// ---- Get my PRO profile ----
export async function getMyProProfile(): Promise<ProProfile | null> {
  const res = await api.get<ProProfile>('/pro/me');
  return res.data ?? null;
}

// ---- Get PRO benefits ----
export async function getProBenefits(): Promise<ProBenefits> {
  const res = await api.get<ProBenefits>('/pro/benefits');
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Request PRO access ----
export async function requestProAccess(payload: RequestProPayload): Promise<ProProfile> {
  const res = await api.post<ProProfile>('/pro/request', payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Admin: List all PRO profiles ----
export async function getAllProProfiles(params?: {
  status?: ProStatus;
  page?: number;
}): Promise<{ data: ProProfile[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));

  const endpoint = `/pro${query.toString() ? `?${query}` : ''}`;
  const res = await api.get<{ data: ProProfile[]; total: number }>(endpoint);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Admin: Get pending count ----
export async function getPendingProCount(): Promise<number> {
  const res = await api.get<{ count: number }>('/pro/pending-count');
  return res.data?.count ?? 0;
}

// ---- Admin: Approve ----
export async function approveProRequest(
  id: string,
  payload: { discount_percentage?: number; priority_shipping?: boolean; early_access?: boolean },
): Promise<ProProfile> {
  const res = await api.post<ProProfile>(`/pro/${id}/approve`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Admin: Reject ----
export async function rejectProRequest(id: string, rejection_reason: string): Promise<ProProfile> {
  const res = await api.post<ProProfile>(`/pro/${id}/reject`, { rejection_reason });
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Admin: Suspend ----
export async function suspendProMember(id: string): Promise<ProProfile> {
  const res = await api.post<ProProfile>(`/pro/${id}/suspend`, {});
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Status label ----
export function getProStatusLabel(status: ProStatus): string {
  const labels: Record<ProStatus, string> = {
    pending: 'Pendiente de aprobación',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    suspended: 'Suspendido',
  };
  return labels[status] ?? status;
}
