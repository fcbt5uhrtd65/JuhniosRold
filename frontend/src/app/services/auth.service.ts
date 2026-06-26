// ============================================================
// Auth Service — Juhnios Rold Frontend
// Handles: register, login, refresh, me, logout
// ============================================================

import { api, ApiError, setTokens, clearTokens } from './api';

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
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  reference?: string;
  purchase_mode?: 'RETAIL' | 'WHOLESALE';
  company_id_type?: string;
  company_id_type_other?: string;
  company_id_number?: string;
  company_name?: string;
  business_type?: string;
  is_international_distributor?: boolean;
  company_phone?: string;
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

// ---- Check availability ----
export interface AvailabilityErrors {
  email?: string;
  document_number?: string;
}

export async function checkRegistrationAvailability(
  email: string,
  documentNumber?: string,
): Promise<AvailabilityErrors> {
  try {
    await api.post('/auth/register/check-availability/', {
      email: email.trim().toLowerCase(),
      document_number: documentNumber?.trim() ?? '',
    });
    return {};
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const result: AvailabilityErrors = {};
      for (const msg of err.errors ?? []) {
        const colonIdx = msg.indexOf(': ');
        if (colonIdx === -1) continue;
        const field = msg.slice(0, colonIdx);
        const text = msg.slice(colonIdx + 2);
        if (field === 'email') result.email = text;
        if (field === 'document_number') result.document_number = text;
      }
      return result;
    }
    throw err;
  }
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

export interface PasswordResetRequestResult {
  verification_id?: string;
  email?: string;
  expires_at?: string;
  debug_code?: string;
  message?: string;
}

export interface PasswordResetVerifyResult {
  reset_token: string;
  message?: string;
}

export async function requestPasswordResetCode(
  email: string,
): Promise<PasswordResetRequestResult> {
  const res = await api.post<PasswordResetRequestResult>('/auth/password-reset/', {
    email: email.trim().toLowerCase(),
  });
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function verifyPasswordResetCode(
  verificationId: string,
  code: string,
): Promise<PasswordResetVerifyResult> {
  const res = await api.post<PasswordResetVerifyResult>('/auth/password-reset/verify/', {
    verification_id: verificationId,
    code,
  });
  if (!res.data?.reset_token) throw new Error(res.message);
  return res.data;
}

export async function confirmPasswordReset(
  resetToken: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/password-reset/confirm/', {
    token: resetToken,
    new_password: newPassword,
  });
}

// ---- Logout ----
export async function logoutUser(): Promise<void> {
  clearTokens();
}
