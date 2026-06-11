import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';

import {
  getPaymentStatus,
  type PaymentStatus,
} from '../services/payments.service';

const FINAL_STATUSES = new Set([
  'APPROVED',
  'DECLINED',
  'ERROR',
  'VOIDED',
  'EXPIRED',
]);

export function PaymentResult() {
  const orderId = new URLSearchParams(window.location.search).get('pedido_id');
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setError('No se recibió el identificador del pedido.');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const result = await getPaymentStatus(orderId, controller.signal);
        if (cancelled) return;
        setPayment(result);
        if (!result.payment_status || !FINAL_STATUSES.has(result.payment_status)) {
          attempts += 1;
          if (attempts < 20) window.setTimeout(poll, 3000);
        }
      } catch (pollError) {
        if (cancelled) return;
        setError(
          pollError instanceof Error
            ? pollError.message
            : 'No fue posible consultar el estado del pago.',
        );
      }
    };

    void poll();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [orderId]);

  const approved = payment?.payment_status === 'APPROVED';
  const failed =
    payment?.payment_status != null &&
    FINAL_STATUSES.has(payment.payment_status) &&
    !approved;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section className="w-full max-w-lg border border-border bg-background p-10 text-center">
        {approved ? (
          <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-5" />
        ) : failed ? (
          <XCircle className="w-14 h-14 text-red-600 mx-auto mb-5" />
        ) : (
          <Clock3 className="w-14 h-14 text-amber-600 mx-auto mb-5" />
        )}
        <h1 className="text-2xl mb-3">
          {approved
            ? 'Pago confirmado'
            : failed
              ? 'El pago no fue aprobado'
              : 'Estamos confirmando tu pago'}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          El estado definitivo se obtiene desde el proveedor configurado.
          Puedes cerrar esta pantalla y consultar el pedido más tarde.
        </p>
        {payment && (
          <div className="bg-secondary p-4 text-sm text-left space-y-2 mb-6">
            <div>Pedido: {payment.order_id}</div>
            <div>Estado del pedido: {payment.order_status}</div>
            <div>Estado del pago: {payment.payment_status ?? 'PENDING'}</div>
            {payment.payment_method && <div>Método: {payment.payment_method}</div>}
            {payment.invoice_number && (
              <div>Factura interna: {payment.invoice_number}</div>
            )}
          </div>
        )}
        {error && <div className="text-sm text-red-700 mb-6">{error}</div>}
        <a
          href="/"
          className="inline-block px-8 py-4 bg-foreground text-background text-xs tracking-wider uppercase"
        >
          Volver a la tienda
        </a>
      </section>
    </main>
  );
}
