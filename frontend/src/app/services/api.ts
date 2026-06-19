// ============================================================
// API Client Base — Juhnios Rold Frontend
// Connects to backend at VITE_API_URL (default: /api/v1 via Vite proxy)
// and normalizes both DRF raw responses and custom enveloped payloads.
// ============================================================

export const API_BASE_URL: string =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta as any).env?.VITE_API_URL ?? '/api/v1';

// ---- Token management ----
export const TOKEN_KEYS = {
  ACCESS: 'jr_access_token',
  REFRESH: 'jr_refresh_token',
};

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.ACCESS);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.REFRESH);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEYS.ACCESS, accessToken);
  localStorage.setItem(TOKEN_KEYS.REFRESH, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEYS.ACCESS);
  localStorage.removeItem(TOKEN_KEYS.REFRESH);
}

function tokenExpiresSoon(token: string, thresholdSeconds = 30): boolean {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return true;
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      '=',
    );
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 <= Date.now() + thresholdSeconds * 1000;
  } catch {
    return true;
  }
}

// ---- Safe timeout helper (replaces AbortSignal.timeout which is not universally available) ----
function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

// ---- API Response type ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  meta?: Record<string, unknown>;
}

function isApiResponseEnvelope<T>(value: unknown): value is ApiResponse<T> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'success' in value && ('data' in value || 'message' in value);
}

function extractErrors(payload: unknown): string[] | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string') {
    return [detail];
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') {
    return [message];
  }

  const fieldErrors = Object.entries(payload as Record<string, unknown>)
    .flatMap(([field, value]) => {
      if (Array.isArray(value)) {
        return value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => `${field}: ${item}`);
      }

      if (typeof value === 'string') {
        return [`${field}: ${value}`];
      }

      return [];
    });

  return fieldErrors.length > 0 ? fieldErrors : undefined;
}

function extractMessage(payload: unknown, status: number): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const asRecord = payload as Record<string, unknown>;

    if (typeof asRecord.message === 'string' && asRecord.message.trim()) {
      return asRecord.message;
    }

    if (typeof asRecord.detail === 'string' && asRecord.detail.trim()) {
      return asRecord.detail;
    }
  }

  if (status >= 500) {
    return 'Ocurrió un error interno al comunicarse con el servidor.';
  }

  if (status === 401) {
    return 'No autorizado. Por favor inicia sesión de nuevo.';
  }

  if (status === 403) {
    return 'No tienes permisos para realizar esta acción.';
  }

  if (status === 404) {
    return 'No se encontró el recurso solicitado.';
  }

  return `Error ${status}`;
}

// ---- Custom API Error ----
export class ApiError extends Error {
  status: number;
  errors?: string[];

  constructor(message: string, status: number, errors?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

// ---- Backend reachability (successful checks are cached briefly) ----
let _backendAvailable: boolean | null = null;
let _checkPromise: Promise<boolean> | null = null;

function getBackendOrigin(): string {
  return new URL(API_BASE_URL, window.location.origin).origin;
}

function getBackendHealthUrl(): string {
  return `${getBackendOrigin()}/health/`;
}

export function resolveBackendUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${getBackendOrigin()}${path}`;
}

export async function isBackendAvailable(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  if (_checkPromise) return _checkPromise;

  _checkPromise = (async () => {
    const { signal, clear } = createTimeoutSignal(5000);
    try {
      const res = await fetch(getBackendHealthUrl(), {
        method: 'GET',
        signal,
      });
      if (!res.ok) return false;

      _backendAvailable = true;
      setTimeout(() => {
        _backendAvailable = null;
      }, 15_000);
      return true;
    } catch {
      // Do not cache transient network/proxy failures.
      return false;
    } finally {
      clear();
    }
  })().finally(() => { _checkPromise = null; });

  return _checkPromise;
}

// ---- Token refresh ----
let _refreshPromise: Promise<string | null> | null = null;

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const { signal, clear } = createTimeoutSignal(8000);
  try {
    const res = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
      signal,
    });
    clear();

    if (!res.ok) { clearTokens(); return null; }

    const data = await res.json().catch(() => null) as
      | { access?: string; refresh?: string }
      | null;

    if (data?.access) {
      setTokens(data.access, data.refresh ?? refreshToken);
      return data.access;
    }

    return null;
  } catch {
    clear();
    return null;
  }
}

export class AuthSessionError extends ApiError {
  constructor(message = 'Tu sesión expiró o ya no tiene credenciales válidas.') {
    super(message, 401);
    this.name = 'AuthSessionError';
  }
}

type AuthSessionListener = (reason: 'missing-token' | 'expired-token' | 'unauthorized') => void;

const authSessionListeners = new Set<AuthSessionListener>();

export function onAuthSessionInvalidated(listener: AuthSessionListener): () => void {
  authSessionListeners.add(listener);
  return () => {
    authSessionListeners.delete(listener);
  };
}

function notifyAuthSessionInvalidated(reason: 'missing-token' | 'expired-token' | 'unauthorized'): void {
  authSessionListeners.forEach((listener) => {
    try {
      listener(reason);
    } catch {
      // Listener errors should not break request handling.
    }
  });
}

async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = performTokenRefresh().finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

// ---- Core request function ----
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const isAuthenticationRequest =
    endpoint === '/auth/login/' ||
    endpoint === '/auth/register/' ||
    endpoint.startsWith('/auth/register/') ||
    endpoint.startsWith('/auth/password-reset/') ||
    endpoint.startsWith('/auth/token/');
  let token = getAccessToken();
  if (!token && !isAuthenticationRequest) {
    notifyAuthSessionInvalidated('missing-token');
    throw new AuthSessionError();
  }
  if (token && !isAuthenticationRequest && tokenExpiresSoon(token)) {
    token = await refreshAccessToken();
  }
  if (!token && !isAuthenticationRequest) {
    notifyAuthSessionInvalidated('missing-token');
    throw new AuthSessionError();
  }
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Use caller's signal or create a 15s timeout
  const ownTimeout = !options.signal ? createTimeoutSignal(15_000) : null;
  const signal = options.signal ?? ownTimeout!.signal;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers, signal });
  } finally {
    ownTimeout?.clear();
  }

  // Refresh only expired authenticated sessions. A rejected login must not be retried.
  if (res.status === 401 && retry && !isAuthenticationRequest) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiRequest<T>(endpoint, options, false);
    clearTokens();
    notifyAuthSessionInvalidated('unauthorized');
    throw new AuthSessionError();
  }

  const payload = await res.json().catch(() => null) as T | ApiResponse<T> | null;

  if (!res.ok) {
    if (res.status === 401) {
      clearTokens();
      notifyAuthSessionInvalidated('unauthorized');
      throw new AuthSessionError();
    }
    throw new ApiError(
      extractMessage(payload, res.status),
      res.status,
      extractErrors(payload),
    );
  }

  if (isApiResponseEnvelope<T>(payload)) {
    return payload;
  }

  return {
    success: true,
    message: 'OK',
    data: payload ?? undefined,
  };
}

export async function publicApiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const ownTimeout = !options.signal ? createTimeoutSignal(15_000) : null;
  const signal = options.signal ?? ownTimeout!.signal;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers, signal });
  } finally {
    ownTimeout?.clear();
  }

  const payload = await res.json().catch(() => null) as T | ApiResponse<T> | null;

  if (!res.ok) {
    throw new ApiError(
      extractMessage(payload, res.status),
      res.status,
      extractErrors(payload),
    );
  }

  if (isApiResponseEnvelope<T>(payload)) {
    return payload;
  }

  return {
    success: true,
    message: 'OK',
    data: payload ?? undefined,
  };
}

function prepareBody(body: unknown): BodyInit {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return body;
  }

  return JSON.stringify(body);
}

// ---- Convenience helpers ----
export const api = {
  get: <T>(endpoint: string, signal?: AbortSignal) =>
    apiRequest<T>(endpoint, { method: 'GET', ...(signal ? { signal } : {}) }),

  post: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'POST', body: prepareBody(body) }),

  patch: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body: prepareBody(body) }),

  put: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'PUT', body: prepareBody(body) }),

  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};

export const publicApi = {
  get: <T>(endpoint: string, signal?: AbortSignal) =>
    publicApiRequest<T>(endpoint, { method: 'GET', ...(signal ? { signal } : {}) }),
};
