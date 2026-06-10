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

// ---- Register ----
export async function registerUser(payload: RegisterPayload): Promise<AuthUser> {
  const res = await api.post<AuthResponseData>('/auth/register', payload);
  if (res.data) {
    setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    return res.data.user;
  }
  throw new Error(res.message);
}

// ---- Login ----
export async function loginUser(payload: LoginPayload): Promise<AuthUser> {
  const res = await api.post<AuthResponseData>('/auth/login', payload);
  if (res.data) {
    setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    return res.data.user;
  }
  throw new Error(res.message);
}

// ---- Get current user (validates token) ----
export async function getCurrentUser(): Promise<AuthUser> {
  const res = await api.get<AuthUser>('/auth/me');
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Logout ----
export async function logoutUser(): Promise<void> {
  try {
    await api.post('/auth/logout', {});
  } finally {
    clearTokens();
  }
}
