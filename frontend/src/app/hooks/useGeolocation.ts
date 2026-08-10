// ============================================================
// useGeolocation Hook — Juhnios Rold Frontend
// Wraps navigator.geolocation with permission/error handling
// ============================================================

import { useCallback, useEffect, useState } from 'react';

export type GeolocationStatus = 'idle' | 'prompt' | 'loading' | 'success' | 'error' | 'unsupported';

export type GeolocationErrorKind = 'permission-denied' | 'position-unavailable' | 'timeout' | 'unsupported' | 'unknown';

const MESSAGES: Record<GeolocationErrorKind, string> = {
  // La UI (DeliveryLocationSection) añade un segundo párrafo con los pasos exactos para
  // reactivarlo cuando permissionBlocked es true — este mensaje se mantiene corto para no
  // duplicar esa instrucción.
  'permission-denied': 'Bloqueaste el permiso de ubicación para este sitio.',
  'position-unavailable':
    'No pudimos determinar tu ubicación en este momento. Verifica tu conexión o el GPS del dispositivo, o busca y selecciona tu dirección manualmente abajo.',
  timeout:
    'La búsqueda de tu ubicación tardó demasiado. Puedes intentarlo de nuevo o buscar y seleccionar tu dirección manualmente abajo.',
  unsupported:
    'Tu navegador no permite compartir la ubicación automáticamente. Busca y selecciona tu dirección manualmente abajo.',
  unknown:
    'No pudimos obtener tu ubicación actual. Puedes buscar y seleccionar tu dirección manualmente abajo.',
};

/** @deprecated kept for backwards compatibility with existing imports; prefer reading `errorMessage`. */
export const GEOLOCATION_FALLBACK_MESSAGE = MESSAGES.unknown;

function errorKindFromCode(code: number): GeolocationErrorKind {
  switch (code) {
    case GeolocationPositionError.PERMISSION_DENIED:
      return 'permission-denied';
    case GeolocationPositionError.POSITION_UNAVAILABLE:
      return 'position-unavailable';
    case GeolocationPositionError.TIMEOUT:
      return 'timeout';
    default:
      return 'unknown';
  }
}

export interface UseGeolocationResult {
  status: GeolocationStatus;
  coords: { lat: number; lng: number } | null;
  errorMessage: string;
  errorKind: GeolocationErrorKind | null;
  /** True once the browser has permanently blocked the permission (detected via the Permissions API when available). */
  permissionBlocked: boolean;
  /**
   * Starts the flow. When the Permissions API confirms the permission is already 'granted', it
   * requests the position immediately (no extra click). Otherwise — not yet decided, or the
   * Permissions API isn't available to check — it shows our own explanation first ('prompt')
   * before the native browser dialog appears; call `confirmRequest()` to continue. If already
   * denied, it skips straight to the guidance message since the browser won't prompt again.
   */
  requestLocation: () => void;
  /** Confirms the explanation shown on 'prompt' and triggers the native browser permission dialog. */
  confirmRequest: () => void;
  /** Cancels the 'prompt' explanation without asking the browser for permission. */
  cancelPrompt: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorKind, setErrorKind] = useState<GeolocationErrorKind | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  // Best-effort check of the current permission state so we can skip the explanatory prompt
  // when it's already granted, and flag it as blocked when already denied — the browser won't
  // show its own dialog again once a permission has been denied.
  useEffect(() => {
    if (!('permissions' in navigator) || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(result => {
        if (cancelled) return;
        setPermissionState(result.state);
        const onChange = () => setPermissionState(result.state);
        result.addEventListener('change', onChange);
      })
      .catch(() => {
        // Permissions API not supported for 'geolocation' in this browser — ignore, fall back to try/error.
      });
    return () => { cancelled = true; };
  }, []);

  const doRequest = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      setErrorKind('unsupported');
      return;
    }

    setStatus('loading');
    setErrorKind(null);

    navigator.geolocation.getCurrentPosition(
      position => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus('success');
        setPermissionState('granted');
      },
      error => {
        const kind = errorKindFromCode(error.code);
        console.warn('[useGeolocation] getCurrentPosition error', error.code, error.message);
        setStatus('error');
        setErrorKind(kind);
        if (kind === 'permission-denied') setPermissionState('denied');
      },
      // maximumAge: 0 — a delivery pin can't tolerate a stale cached fix (the user may have moved
      // since the last reading), unlike the IP-based approximate center which only needs a rough area.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      setErrorKind('unsupported');
      return;
    }
    // Permission already denied: don't bother showing the explanatory prompt, the browser
    // won't ask again — go straight to the guidance message.
    if (permissionState === 'denied') {
      setStatus('error');
      setErrorKind('permission-denied');
      return;
    }
    // Already granted: skip the explanation, request immediately.
    if (permissionState === 'granted') {
      doRequest();
      return;
    }
    // Not yet decided (or unknown, Permissions API unavailable): show our own explanation
    // first so the native permission dialog isn't a surprise.
    setStatus('prompt');
  }, [permissionState, doRequest]);

  const confirmRequest = useCallback(() => {
    doRequest();
  }, [doRequest]);

  const cancelPrompt = useCallback(() => {
    setStatus('idle');
  }, []);

  const errorMessage = errorKind ? MESSAGES[errorKind] : '';

  return {
    status,
    coords,
    errorMessage,
    errorKind,
    permissionBlocked: permissionState === 'denied',
    requestLocation,
    confirmRequest,
    cancelPrompt,
  };
}
