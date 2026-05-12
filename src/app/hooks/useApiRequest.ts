// ============================================================
// useApiRequest Hook — Juhnios Rold Frontend
// Generic hook for API calls with loading/error/data state
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { ApiError } from '../services/api';

export interface ApiRequestState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

/**
 * One-shot mutation hook (for POST/PATCH/DELETE)
 */
export function useApiMutation<T, P = unknown>(
  fn: (payload: P) => Promise<T>,
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  mutate: (payload: P) => Promise<T | null>;
  reset: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (payload: P): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn(payload);
        setData(result);
        return result;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Error desconocido';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, mutate, reset };
}

/**
 * Auto-fetch hook (for GET queries that run on mount)
 */
export function useApiQuery<T>(
  fn: () => Promise<T>,
  enabled = true,
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await fn();
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Error desconocido';
      setError(msg);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (enabled) {
      execute();
    }
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [execute, enabled]);

  return { data, loading, error, refetch: execute };
}
