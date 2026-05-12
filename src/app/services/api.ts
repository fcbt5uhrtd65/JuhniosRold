// ============================================================
// API Client Base — Juhnios Rold Frontend
// Connects to backend at VITE_API_URL (default: /api via Vite proxy)
// Falls back gracefully when backend is unavailable.
// ============================================================

export const API_BASE_URL: string =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta as any).env?.VITE_API_URL ?? '/api';

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
      // Use the proxied health endpoint so it works in all environments
      const healthUrl = API_BASE_URL.endsWith('/api')
        ? `${API_BASE_URL.slice(0, -4)}/health`
        : '/health';

      const res = await fetch(healthUrl, { method: 'GET', signal });
      clear();
      _backendAvailable = res.ok;
    } catch {
      _backendAvailable = false;
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
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal,
    });
    clear();

    if (!res.ok) { clearTokens(); return null; }

    const data: ApiResponse<{ accessToken: string; refreshToken: string }> = await res.json();
    if (data.success && data.data) {
      setTokens(data.data.accessToken, data.data.refreshToken);
      return data.data.accessToken;
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
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
    throw new ApiError('No autorizado. Por favor inicia sesión de nuevo.', 401);
  }

  const data = await res.json().catch(() => ({
    success: false,
    message: 'Error al procesar la respuesta del servidor',
  })) as ApiResponse<T>;

  if (!res.ok) {
    throw new ApiError(data.message || `Error ${res.status}`, res.status, data.errors);
  }

  return data;
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
