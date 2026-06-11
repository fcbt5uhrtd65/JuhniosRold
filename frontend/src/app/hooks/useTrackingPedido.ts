import { useCallback, useEffect, useState } from 'react';
import {
  getTrackingPedido,
  type TrackingPedido,
} from '../services/enviosApi';

export function useTrackingPedido(pedidoId?: string) {
  const [tracking, setTracking] = useState<TrackingPedido | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!pedidoId) {
      setTracking(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setTracking(await getTrackingPedido(pedidoId, signal));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(
        caught instanceof Error
          ? caught.message
          : 'No fue posible consultar el seguimiento.',
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  return { tracking, isLoading, error, reload: () => reload() };
}
