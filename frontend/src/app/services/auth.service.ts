// ============================================================
// Auth Service — Juhnios Rold Frontend
// Handles: register, login, refresh, me, logout
// ============================================================

import { api, setTokens, clearTokens } from './api';

export type UserRole =
  | 'ADMIN'
  | 'CLIENT'
  | 'PRO'
  | 'SELLER'
  | 'DISTRIBUTOR'
  | 'RRHH'
  | 'EMPLEADO'
  | 'PEDIDOS';

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
  document_type?: string;
  document_number?: string;
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

export interface RegistrationVerification {
  verification_id: string;
  email: string;
  expires_at: string;
  debug_code?: string;
  message?: string;
}

interface RegisterVerifyResponse extends BackendTokenPair {
  user: AuthUser;
}

// ---- Register ----
export async function startRegistration(
  payload: RegisterPayload,
): Promise<RegistrationVerification> {
  const res = await api.post<RegistrationVerification>('/auth/register/', payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function verifyRegistrationCode(
  verificationId: string,
  code: string,
): Promise<AuthUser> {
  const res = await api.post<RegisterVerifyResponse>('/auth/register/verify/', {
    verification_id: verificationId,
    code,
  });
  if (!res.data?.access || !res.data.refresh || !res.data.user) {
    throw new Error('El servidor no devolvio una sesion valida.');
  }
  setTokens(res.data.access, res.data.refresh);
  return res.data.user;
}

export async function resendRegistrationCode(
  verificationId: string,
): Promise<RegistrationVerification> {
  const res = await api.post<RegistrationVerification>('/auth/register/resend-code/', {
    verification_id: verificationId,
  });
  if (!res.data) throw new Error(res.message);
  return res.data;
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

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/password-reset/', {
    email: email.trim().toLowerCase(),
  });
}

// ---- Logout ----
export async function logoutUser(): Promise<void> {
  clearTokens();
}
