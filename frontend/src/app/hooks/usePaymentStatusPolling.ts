import { useEffect, useRef, useState } from 'react';
import { getPaymentStatus, type PaymentStatus } from '../services/payments.service';

const FINAL_STATUSES = new Set(['APPROVED', 'DECLINED', 'ERROR', 'VOIDED', 'EXPIRED']);
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;
const CHANNEL_NAME = 'juhniosrold-payment-status';
const STORAGE_KEY_PREFIX = 'juhniosrold-payment-status:';

export type PaymentPollingState = 'idle' | 'polling' | 'approved' | 'failed' | 'timeout' | 'error';

interface UsePaymentStatusPollingResult {
  state: PaymentPollingState;
  payment: PaymentStatus | null;
  errorMessage: string;
}

interface BroadcastPayload {
  orderId: string;
  payment: PaymentStatus;
}

/**
 * El pago con Wompi se completa en una pestaña aparte; al volver, Wompi navega
 * esa MISMA pestaña a /pago/resultado, no la original. Sin esto, la pestaña
 * original solo se entera vía su propio polling, que puede haber llegado a
 * 'timeout' (60s) para cuando el usuario ya pagó. BroadcastChannel (con
 * localStorage como respaldo para navegadores que no lo soportan) deja que
 * cualquier pestaña que resuelva el estado final se lo notifique a las demás
 * al instante.
 */
function broadcastFinalStatus(orderId: string, payment: PaymentStatus) {
  const detail: BroadcastPayload = { orderId, payment };
  try {
    new BroadcastChannel(CHANNEL_NAME).postMessage(detail);
  } catch {
    // BroadcastChannel no disponible; localStorage es el único respaldo.
  }
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + orderId, JSON.stringify({ payment, ts: Date.now() }));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena, etc.): sin respaldo posible.
  }
}

export function usePaymentStatusPolling(
  orderId: string | null,
  /** Cambiar este valor reinicia el polling sin necesidad de tocar orderId (p.ej. botón "Verificar de nuevo" tras un timeout). */
  restartKey: number = 0,
): UsePaymentStatusPollingResult {
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [state, setState] = useState<PaymentPollingState>(orderId ? 'polling' : 'idle');
  const [errorMessage, setErrorMessage] = useState('');
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!orderId) {
      setState('idle');
      return;
    }

    setState('polling');
    setPayment(null);
    setErrorMessage('');
    attemptsRef.current = 0;

    let cancelled = false;
    const controller = new AbortController();

    const applyFinalStatus = (result: PaymentStatus) => {
      if (cancelled) return;
      setPayment(result);
      setState(result.payment_status === 'APPROVED' ? 'approved' : 'failed');
      cancelled = true;
      controller.abort();
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<BroadcastPayload>) => {
        if (event.data?.orderId !== orderId) return;
        const result = event.data.payment;
        if (result.payment_status && FINAL_STATUSES.has(result.payment_status)) {
          applyFinalStatus(result);
        }
      };
    } catch {
      // Sin BroadcastChannel disponible; se sigue solo con localStorage.
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY_PREFIX + orderId || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { payment: PaymentStatus };
        if (parsed.payment.payment_status && FINAL_STATUSES.has(parsed.payment.payment_status)) {
          applyFinalStatus(parsed.payment);
        }
      } catch {
        // Valor corrupto en localStorage: se ignora, el polling propio sigue como respaldo.
      }
    };
    window.addEventListener('storage', onStorage);

    const poll = async () => {
      try {
        const result = await getPaymentStatus(orderId, controller.signal);
        if (cancelled) return;
        setPayment(result);

        if (result.payment_status && FINAL_STATUSES.has(result.payment_status)) {
          setState(result.payment_status === 'APPROVED' ? 'approved' : 'failed');
          broadcastFinalStatus(orderId, result);
          return;
        }

        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setState('timeout');
          return;
        }
        window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch (pollError) {
        if (cancelled) return;
        setErrorMessage(
          pollError instanceof Error
            ? pollError.message
            : 'No fue posible consultar el estado del pago.',
        );
        setState('error');
      }
    };

    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      channel?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [orderId, restartKey]);

  return { state, payment, errorMessage };
}
