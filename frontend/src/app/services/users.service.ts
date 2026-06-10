// ============================================================
// Users Service — Juhnios Rold Frontend
// Handles: profile, saved products, admin user management
// ============================================================

import { api } from './api';
import type { AuthUser } from './auth.service';

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface SavedProduct {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

// ---- Get profile ----
export async function getMyProfile(): Promise<AuthUser> {
  const res = await api.get<AuthUser>('/auth/users/me/');
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Update profile ----
export async function updateMyProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
  const res = await api.patch<AuthUser>('/auth/users/me/', payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Change password ----
export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await api.patch('/auth/users/me/password/', payload);
}

// ---- Saved products ----
export async function getSavedProducts(): Promise<SavedProduct[]> {
  const res = await api.get<SavedProduct[]>('/users/me/saved');
  return res.data ?? [];
}

export async function saveProduct(productId: string): Promise<SavedProduct> {
  const res = await api.post<SavedProduct>('/users/me/saved', { product_id: productId });
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function removeSavedProduct(productId: string): Promise<void> {
  await api.delete(`/users/me/saved/${productId}`);
}

// ---- Admin: List users ----
export async function getAllUsers(params?: {
  page?: number;
  limit?: number;
  role?: string;
  search?: string;
}): Promise<{ data: AuthUser[]; total: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('page_size', String(params.limit));
  if (params?.search) query.set('search', params.search);

  const endpoint = `/auth/users/${query.toString() ? `?${query}` : ''}`;
  const res = await api.get<{
    count: number;
    next: string | null;
    previous: string | null;
    results: AuthUser[];
  }>(endpoint);
  const data = res.data;
  if (!data) throw new Error(res.message);

  const limit = params?.limit ?? 20;
  return {
    data: params?.role ? data.results.filter((user) => user.role === params.role) : data.results,
    total: data.count,
    totalPages: Math.max(1, Math.ceil(data.count / limit)),
  };
}

// ---- Admin: Update user role ----
export async function updateUserRole(userId: string, role: string): Promise<AuthUser> {
  const res = await api.patch<AuthUser>(`/auth/users/${userId}/role/`, { role });
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Admin: Deactivate user ----
export async function deactivateUser(userId: string): Promise<void> {
  await api.patch(`/auth/users/${userId}/`, { is_active: false });
}
