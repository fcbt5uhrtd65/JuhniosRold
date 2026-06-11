import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { useTrackingPedido } from '../hooks/useTrackingPedido';
import { EstadoPedidoBadge } from './EstadoPedidoBadge';
import { TrackingTimeline } from './TrackingTimeline';

export function TrackingPedidoPage({
  pedidoId,
  onClose,
}: {
  pedidoId: string;
  onClose?: () => void;
}) {
  const { tracking, isLoading, error, reload } = useTrackingPedido(pedidoId);

  return (
    <section className="border border-border bg-background p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Seguimiento
          </div>
          <h3 className="mt-1 text-sm">
            {tracking ? `Pedido ${tracking.numero_pedido}` : 'Consultando pedido'}
          </h3>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={reload} title="Actualizar seguimiento">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1} />
          </button>
          {onClose && (
            <button type="button" onClick={onClose} title="Cerrar seguimiento">
              <X className="w-4 h-4" strokeWidth={1} />
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}
      {isLoading && !tracking && (
        <p className="text-xs text-muted-foreground">Cargando seguimiento...</p>
      )}

      {tracking && (
        <div className="space-y-6">
          <EstadoPedidoBadge estado={tracking.estado_pedido} />

          {tracking.envio ? (
            <div className="grid gap-3 border border-border p-4 text-xs sm:grid-cols-2">
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                  Transportadora
                </span>
                {tracking.envio.transportadora?.nombre ?? 'Sin asignar'}
              </div>
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                  Número de guía
                </span>
                {tracking.envio.numero_guia || 'Pendiente'}
              </div>
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                  Entrega estimada
                </span>
                {tracking.envio.fecha_entrega_estimada
                  ? new Date(tracking.envio.fecha_entrega_estimada).toLocaleDateString('es-CO')
                  : 'Por confirmar'}
              </div>
              {tracking.envio.tracking_url && (
                <a
                  href={tracking.envio.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 underline underline-offset-4"
                >
                  Rastrear con transportadora
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={1} />
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              El pedido todavía no tiene una guía asignada.
            </p>
          )}

          <TrackingTimeline
            historialPedido={tracking.historial_pedido}
            eventosEnvio={tracking.envio?.eventos ?? []}
          />
        </div>
      )}
    </section>
  );
}
