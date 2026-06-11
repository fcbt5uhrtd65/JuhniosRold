import { Check, Circle } from 'lucide-react';
import type { HistorialPedido, TrackingEvent } from '../services/enviosApi';

interface TimelineItem {
  id: string;
  status: string;
  description: string;
  location: string;
  date: string;
  kind: 'pedido' | 'envio';
}

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
  GENERANDO_GUIA: 'Generando guía',
  GUIA_GENERADA: 'Guía generada',
  RECOGIDA_PROGRAMADA: 'Recogida programada',
  RECOGIDO: 'Recogido',
  EN_TRANSITO: 'En tránsito',
  EN_REPARTO: 'En reparto',
  ENTREGADO: 'Entregado',
  NOVEDAD: 'Novedad',
  DEVUELTO: 'Devuelto',
  CANCELADO: 'Cancelado',
};

export function TrackingTimeline({
  historialPedido,
  eventosEnvio,
}: {
  historialPedido: HistorialPedido[];
  eventosEnvio: TrackingEvent[];
}) {
  const items: TimelineItem[] = [
    ...historialPedido.map(item => ({
      id: `pedido-${item.id}`,
      status: item.status,
      description: item.notes,
      location: '',
      date: item.created_at,
      kind: 'pedido' as const,
    })),
    ...eventosEnvio.map(item => ({
      id: `envio-${item.id}`,
      status: item.estado,
      description: item.descripcion,
      location: item.ubicacion,
      date: item.fecha_evento,
      kind: 'envio' as const,
    })),
  ].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">Aún no hay eventos registrados.</p>;
  }

  return (
    <ol className="space-y-0">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className="absolute left-[7px] top-4 h-full w-px bg-border" />}
            <span className="relative z-10 mt-1 bg-background">
              {last ? (
                <Check className="w-4 h-4 text-green-600" strokeWidth={1.5} />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">
                  {LABELS[item.status] ?? item.status}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {item.kind}
                </span>
              </div>
              {item.description && (
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              )}
              {item.location && (
                <p className="mt-1 text-[11px] text-muted-foreground">{item.location}</p>
              )}
              <time className="mt-1 block text-[10px] text-muted-foreground">
                {new Date(item.date).toLocaleString('es-CO')}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
