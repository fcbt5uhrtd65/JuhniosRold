// ============================================================
// useGeolocation Hook — Juhnios Rold Frontend
// Wraps navigator.geolocation with permission/error handling
// ============================================================

import { useCallback, useState } from 'react';

export type GeolocationStatus = 'idle' | 'loading' | 'success' | 'error' | 'unsupported';

export const GEOLOCATION_FALLBACK_MESSAGE =
  'Actualmente no podemos obtener tu ubicación actual. Esto puede deberse a permisos del ' +
  'navegador, configuración del dispositivo o problemas de conexión. Puedes buscar y ' +
  'seleccionar tu dirección manualmente.';

export interface UseGeolocationResult {
  status: GeolocationStatus;
  coords: { lat: number; lng: number } | null;
  errorMessage: string;
  requestLocation: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      setErrorMessage(GEOLOCATION_FALLBACK_MESSAGE);
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      position => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus('success');
      },
      error => {
        console.warn('[useGeolocation] getCurrentPosition error', error.code, error.message);
        setStatus('error');
        setErrorMessage(GEOLOCATION_FALLBACK_MESSAGE);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  return { status, coords, errorMessage, requestLocation };
}
