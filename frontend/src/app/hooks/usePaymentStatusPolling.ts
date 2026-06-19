import { useEffect, useRef, useState } from 'react';
import { getPaymentStatus, type PaymentStatus } from '../services/payments.service';

const FINAL_STATUSES = new Set(['APPROVED', 'DECLINED', 'ERROR', 'VOIDED', 'EXPIRED']);
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;

export type PaymentPollingState = 'idle' | 'polling' | 'approved' | 'failed' | 'timeout' | 'error';

interface UsePaymentStatusPollingResult {
  state: PaymentPollingState;
  payment: PaymentStatus | null;
  errorMessage: string;
}

export function usePaymentStatusPolling(orderId: string | null): UsePaymentStatusPollingResult {
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

    const poll = async () => {
      try {
        const result = await getPaymentStatus(orderId, controller.signal);
        if (cancelled) return;
        setPayment(result);

        if (result.payment_status && FINAL_STATUSES.has(result.payment_status)) {
          setState(result.payment_status === 'APPROVED' ? 'approved' : 'failed');
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
    };
  }, [orderId]);

  return { state, payment, errorMessage };
}
