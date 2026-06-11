import { AlertCircle, Check, Clock, Package, Truck } from 'lucide-react';

const LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAYMENT_PENDING: 'En pago',
  PAID: 'Pagado',
  FAILED: 'Fallido',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Preparando',
  PACKED: 'Empacado',
  SHIPPED: 'Despachado',
  IN_TRANSIT: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devuelto',
};

export function EstadoPedidoBadge({ estado }: { estado: string }) {
  const normalized = estado.toUpperCase();
  const isDone = normalized === 'DELIVERED';
  const isProblem = ['FAILED', 'CANCELLED', 'RETURNED'].includes(normalized);
  const isMoving = ['SHIPPED', 'IN_TRANSIT'].includes(normalized);
  const isWaiting = ['PENDING', 'PAYMENT_PENDING'].includes(normalized);
  const Icon = isDone
    ? Check
    : isProblem
      ? AlertCircle
      : isMoving
        ? Truck
        : isWaiting
          ? Clock
          : Package;
  const color = isDone
    ? 'bg-green-50 border-green-200 text-green-800'
    : isProblem
      ? 'bg-red-50 border-red-200 text-red-800'
      : isMoving
        ? 'bg-blue-50 border-blue-200 text-blue-800'
        : isWaiting
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-secondary border-border text-foreground';

  return (
    <span className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[10px] uppercase tracking-wider ${color}`}>
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
      {LABELS[normalized] ?? estado}
    </span>
  );
}
