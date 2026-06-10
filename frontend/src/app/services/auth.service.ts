// ============================================================
// Auth Service — Juhnios Rold Frontend
// Handles: register, login, refresh, me, logout
// ============================================================

import { api, setTokens, clearTokens } from './api';

export type UserRole = 'ADMIN' | 'PRO' | 'SELLER' | 'DISTRIBUTOR' | 'CLIENT';

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponseData {
  user: AuthUser;
  tokens: AuthTokens;
}

interface BackendTokenPair {
  access: string;
  refresh: string;
}

// ---- Register ----
export async function registerUser(payload: RegisterPayload): Promise<AuthUser> {
  await api.post('/auth/register/', payload);
  return loginUser({ email: payload.email, password: payload.password });
}

// ---- Login ----
export async function loginUser(payload: LoginPayload): Promise<AuthUser> {
  const res = await api.post<BackendTokenPair>('/auth/login/', payload);
  if (!res.data?.access || !res.data.refresh) {
    throw new Error('El servidor no devolvio una sesion valida.');
  }

  setTokens(res.data.access, res.data.refresh);
  return getCurrentUser();
}

// ---- Get current user (validates token) ----
export async function getCurrentUser(): Promise<AuthUser> {
  const res = await api.get<AuthUser>('/auth/users/me/');
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Logout ----
export async function logoutUser(): Promise<void> {
  clearTokens();
}
