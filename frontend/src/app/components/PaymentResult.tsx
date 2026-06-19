import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { usePaymentStatusPolling } from '../hooks/usePaymentStatusPolling';

interface PaymentResultProps {
  onReturnToStore: () => void;
}

export function PaymentResult({ onReturnToStore }: PaymentResultProps) {
  const orderId = new URLSearchParams(window.location.search).get('pedido_id');
  const { state, payment, errorMessage } = usePaymentStatusPolling(orderId);

  const approved = state === 'approved';
  const failed = state === 'failed' || state === 'timeout' || state === 'error';

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
            : state === 'failed'
              ? 'El pago no fue aprobado'
              : state === 'timeout'
                ? 'Aún no hay confirmación'
                : 'Estamos confirmando tu pago'}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          El estado definitivo se obtiene desde el proveedor configurado.
          Puedes cerrar esta pantalla y consultar el pedido más tarde en Mis Pedidos.
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
        {errorMessage && <div className="text-sm text-red-700 mb-6">{errorMessage}</div>}
        {!orderId && (
          <div className="text-sm text-red-700 mb-6">No se recibió el identificador del pedido.</div>
        )}
        <button
          type="button"
          onClick={onReturnToStore}
          className="inline-block px-8 py-4 bg-foreground text-background text-xs tracking-wider uppercase"
        >
          Volver a la tienda
        </button>
      </section>
    </main>
  );
}
