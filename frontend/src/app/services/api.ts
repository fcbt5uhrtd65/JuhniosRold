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

// ---- Backend reachability (cached, re-checks every 60s) ----
let _backendAvailable: boolean | null = null;
let _checkPromise: Promise<boolean> | null = null;

export async function isBackendAvailable(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  if (_checkPromise) return _checkPromise;

  _checkPromise = (async () => {
    const { signal, clear } = createTimeoutSignal(3000);
    try {
      const res = await fetch('/health', { method: 'GET', signal });
      _backendAvailable = res.ok;
    } catch {
      _backendAvailable = false;
    } finally {
      clear();
    }
    // Re-check after 60s
    setTimeout(() => { _backendAvailable = null; }, 60_000);
    return _backendAvailable;
  })().finally(() => { _checkPromise = null; });

  return _checkPromise;
}

// ---- Token refresh ----
async function refreshAccessToken(): Promise<string | null> {
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

// ---- Core request function ----
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAccessToken();
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

  // 401 → try refresh once
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiRequest<T>(endpoint, options, false);
    clearTokens();
    return apiRequest<T>(endpoint, options, false);
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

// ---- Convenience helpers ----
export const api = {
  get: <T>(endpoint: string, signal?: AbortSignal) =>
    apiRequest<T>(endpoint, { method: 'GET', ...(signal ? { signal } : {}) }),

  post: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),

  patch: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),

  put: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};
