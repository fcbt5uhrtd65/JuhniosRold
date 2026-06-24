import {
  AlertCircle,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import { useTrackingPedido } from '../hooks/useTrackingPedido';
import { getInvoiceByOrder, openInvoicePdf } from '../services/payments.service';
import { useToast } from '../contexts/ToastContext';
import { useState } from 'react';

/* ── 5 pasos visibles ───────────────────────────────────────────────── */
const STEPS = [
  { key: 'PAID',       label: 'Pago confirmado',   icon: Check },
  { key: 'PROCESSING', label: 'Preparando',         icon: Package },
  { key: 'PACKED',     label: 'Listo para envío',   icon: Box },
  { key: 'SHIPPED',    label: 'En camino',           icon: Truck },
  { key: 'DELIVERED',  label: 'Entregado',           icon: CheckCircle2 },
];

const PIPELINE_ORDER = [
  'PENDING', 'PAYMENT_PENDING',
  'PAID', 'CONFIRMED', 'PROCESSING', 'PACKED',
  'SHIPPED', 'IN_TRANSIT',
  'DELIVERED',
];

const FAILED_STATES = new Set(['FAILED', 'CANCELLED', 'RETURNED']);

const LABELS: Record<string, string> = {
  PENDING: 'Pedido recibido',
  PAYMENT_PENDING: 'En proceso de pago',
  PAID: 'Pago confirmado',
  FAILED: 'Pago no completado',
  CONFIRMED: 'Pedido confirmado',
  PROCESSING: 'Preparando tu pedido',
  PACKED: 'Pedido empacado',
  SHIPPED: 'En camino',
  IN_TRANSIT: 'En camino',
  DELIVERED: '¡Pedido entregado!',
  CANCELLED: 'Pedido cancelado',
  RETURNED: 'Pedido devuelto',
  GENERANDO_GUIA: 'Generando guía',
  GUIA_GENERADA: 'Guía lista',
  RECOGIDA_PROGRAMADA: 'Recogida programada',
  RECOGIDO: 'Paquete recogido',
  EN_TRANSITO: 'En tránsito',
  EN_REPARTO: 'En reparto',
  ENTREGADO: 'Entregado',
  NOVEDAD: 'Novedad en envío',
  DEVUELTO: 'Devuelto',
  CANCELADO: 'Envío cancelado',
};

const STATUS_DESC: Record<string, string> = {
  PENDING: 'Recibimos tu pedido. Completa el pago para que comencemos a prepararlo.',
  PAYMENT_PENDING: 'Estamos confirmando tu pago. Esto puede tomar unos minutos.',
  PAID: 'Tu pedido está confirmado y será preparado muy pronto.',
  CONFIRMED: 'Pedido confirmado. Pronto comenzamos a alistarlo para ti.',
  PROCESSING: 'Estamos alistando y empacando tu pedido con mucho cuidado.',
  PACKED: 'Tu pedido está listo. Pronto lo entregamos a la transportadora.',
  SHIPPED: 'Tu pedido está en manos de la transportadora y va hacia ti.',
  IN_TRANSIT: 'Tu pedido está en camino. Pronto llegará a tu dirección.',
  DELIVERED: 'Tu pedido fue entregado. ¡Gracias por tu confianza!',
  CANCELLED: 'Este pedido fue cancelado. Contáctanos si tienes dudas.',
  RETURNED: 'Este pedido fue devuelto. Contáctanos si necesitas ayuda.',
  FAILED: 'El pago no se completó. Puedes intentarlo de nuevo.',
};

const EVENT_DESC: Record<string, string> = {
  PENDING: 'Pedido creado y recibido.',
  PAYMENT_PENDING: 'Iniciando proceso de pago.',
  PAID: 'Pago confirmado correctamente.',
  CONFIRMED: 'Pedido confirmado por el equipo.',
  PROCESSING: 'Comenzamos a preparar tu pedido.',
  PACKED: 'Tu pedido fue empacado y está listo.',
  SHIPPED: 'Pedido entregado a la transportadora.',
  IN_TRANSIT: 'En camino hacia tu dirección.',
  DELIVERED: 'Pedido entregado exitosamente.',
  CANCELLED: 'Pedido cancelado.',
  RETURNED: 'Pedido devuelto.',
  FAILED: 'El pago no fue exitoso.',
};

function getPipelineIndex(estado: string) {
  return PIPELINE_ORDER.indexOf(estado.toUpperCase());
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatFechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* fecha compacta para debajo del paso en la barra */
function formatPasoFecha(iso: string) {
  const d = new Date(iso);
  const dia = d.getDate();
  const mes = d.toLocaleDateString('es-CO', { month: 'short' });
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return `${dia} ${mes}, ${hora}`;
}

/* ── Barra de progreso horizontal con fechas ────────────────────────── */
function ProgressBar({
  estado,
  historial,
}: {
  estado: string;
  historial: Array<{ status: string; created_at: string }>;
}) {
  const normalized = estado.toUpperCase();
  const isFailed = FAILED_STATES.has(normalized);
  if (isFailed) return null;

  const pipelineIdx = getPipelineIndex(normalized);

  const activeStepIdx = (() => {
    let best = -1;
    STEPS.forEach((s, i) => {
      if (getPipelineIndex(s.key) <= pipelineIdx) best = i;
    });
    return best;
  })();

  /* busca la fecha del evento que corresponde a cada step */
  const stepDate = (stepKey: string): string | null => {
    const match = historial
      .filter(h => {
        const hk = h.status.toUpperCase();
        if (stepKey === 'PAID') return ['PAID', 'CONFIRMED'].includes(hk);
        if (stepKey === 'PROCESSING') return hk === 'PROCESSING';
        if (stepKey === 'PACKED') return hk === 'PACKED';
        if (stepKey === 'SHIPPED') return ['SHIPPED', 'IN_TRANSIT'].includes(hk);
        if (stepKey === 'DELIVERED') return hk === 'DELIVERED';
        return false;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    return match ? match.created_at : null;
  };

  const progressPct = activeStepIdx < 0 ? 0 : (activeStepIdx / (STEPS.length - 1)) * 100;

  return (
    <div className="pt-2 pb-1">
      {/* línea + iconos */}
      <div className="relative flex items-center justify-between">
        {/* línea base */}
        <div className="absolute inset-x-4 top-4 h-0.5 bg-stone-200" />
        {/* progreso */}
        {activeStepIdx > 0 && (
          <div
            className="absolute top-4 left-4 h-0.5 bg-emerald-500 transition-all duration-500"
            style={{ width: `calc(${progressPct}% - 2rem)` }}
          />
        )}

        {STEPS.map((step, idx) => {
          const done = idx <= activeStepIdx;
          const active = idx === activeStepIdx;
          const Icon = step.icon;
          const fecha = stepDate(step.key);

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / STEPS.length}%` }}>
              {/* círculo */}
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                active
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                  : done
                    ? 'border-emerald-400 bg-emerald-400 text-white'
                    : 'border-stone-200 bg-white text-stone-300'
              }`}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              {/* label */}
              <span className={`mt-2 text-center text-[10px] font-semibold leading-tight ${
                active ? 'text-stone-900' : done ? 'text-stone-500' : 'text-stone-300'
              }`}>
                {step.label}
              </span>
              {/* fecha si existe */}
              {fecha && done && (
                <span className="mt-0.5 text-center text-[9px] text-stone-400 leading-tight">
                  {formatPasoFecha(fecha)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Historial ──────────────────────────────────────────────────────── */
function EventTimeline({
  historialPedido,
  eventosEnvio,
}: {
  historialPedido: Array<{ id: string; status: string; notes: string; created_at: string }>;
  eventosEnvio: Array<{ id: string; estado: string; descripcion: string; ubicacion: string; fecha_evento: string }>;
}) {
  const all = [
    ...historialPedido.map(h => {
      const key = h.status.toUpperCase();
      return {
        id: `p-${h.id}`,
        label: LABELS[key] ?? h.status,
        desc: (h.notes && !h.notes.toLowerCase().includes('simulad') && !h.notes.toLowerCase().includes('mock'))
          ? h.notes
          : (EVENT_DESC[key] ?? ''),
        location: '',
        date: h.created_at,
        isEnvio: false,
        isFailed: FAILED_STATES.has(key),
      };
    }),
    ...eventosEnvio.map(e => {
      const key = e.estado.toUpperCase();
      return {
        id: `e-${e.id}`,
        label: LABELS[key] ?? e.estado,
        desc: e.descripcion || EVENT_DESC[key] || '',
        location: e.ubicacion,
        date: e.fecha_evento,
        isEnvio: true,
        isFailed: false,
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (all.length === 0) {
    return <p className="py-3 text-xs text-stone-400">Aún no hay movimientos registrados.</p>;
  }

  return (
    <ol className="space-y-0">
      {all.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === all.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-3 last:pb-0">
            {!isLast && <div className="absolute left-[9px] top-[18px] bottom-0 w-px bg-stone-100" />}
            <div className={`relative z-10 mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full ${
              isFirst
                ? item.isFailed ? 'bg-red-100' : 'bg-emerald-500'
                : 'bg-stone-100'
            }`}>
              {isFirst
                ? item.isFailed
                  ? <AlertCircle className="w-2.5 h-2.5 text-red-500" strokeWidth={2} />
                  : <Check className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                : <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`text-xs font-semibold ${isFirst ? 'text-stone-900' : 'text-stone-600'}`}>
                    {item.label}
                  </span>
                  {item.isEnvio && (
                    <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-500">
                      Transportadora
                    </span>
                  )}
                  {item.desc && (
                    <p className="mt-0.5 text-[11px] leading-snug text-stone-400">{item.desc}</p>
                  )}
                  {item.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
                      <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
                      {item.location}
                    </p>
                  )}
                </div>
                <time className="flex-shrink-0 text-[10px] text-stone-300 whitespace-nowrap">
                  {formatFecha(item.date)}
                </time>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Widget de ayuda (columna derecha del tracking) ─────────────────── */
function HelpWidget({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-xs font-bold text-stone-800 mb-1">¿Necesitas ayuda?</p>
        <p className="text-[11px] text-stone-400 leading-relaxed mb-3">
          Estamos aquí para ayudarte con cualquier duda sobre tu pedido.
        </p>
        <a
          href="https://wa.me/573001234567"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 mb-2"
        >
          <MessageCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
          +57 300 123 4567
        </a>
        <a
          href="mailto:contacto@juhniosrold.com"
          className="flex items-center gap-2.5 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
        >
          <Mail className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={1.5} />
          contacto@juhniosrold.com
        </a>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50">
          <ShieldCheck className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-xs font-bold text-stone-800">Compra segura</p>
          <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">Tus datos están protegidos</p>
        </div>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-50"
        >
          <X className="w-3 h-3" strokeWidth={2} />
          Ocultar seguimiento
        </button>
      )}
    </div>
  );
}

/* ── Componente principal ───────────────────────────────────────────── */
export function TrackingPedidoPage({
  pedidoId,
  direccionEnvio,
  onClose,
  onRepeatOrder,
}: {
  pedidoId: string;
  direccionEnvio?: string;
  onClose?: () => void;
  onRepeatOrder?: () => void;
}) {
  const { tracking, isLoading, error, reload } = useTrackingPedido(pedidoId);
  const toast = useToast();
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const handleViewInvoice = async () => {
    setLoadingInvoice(true);
    try {
      const invoice = await getInvoiceByOrder(pedidoId);
      if (!invoice) { toast.warning('No hay factura disponible para este pedido.'); return; }
      await openInvoicePdf(invoice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir la factura.');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const estadoNorm = tracking?.estado_pedido?.toUpperCase() ?? '';
  const isFailed = FAILED_STATES.has(estadoNorm);
  const isDelivered = estadoNorm === 'DELIVERED';
  const hasPaid = estadoNorm !== '' && !['PENDING', 'PAYMENT_PENDING', 'FAILED'].includes(estadoNorm);
  const envio = tracking?.envio;
  const direccionMostrar = envio?.direccion_envio || tracking?.direccion_envio || direccionEnvio || '';
  const ciudadMostrar = envio ? [envio.ciudad, envio.departamento].filter(Boolean).join(', ') : '';

  if (isLoading && !tracking) {
    return (
      <div className="flex items-center gap-2 py-6 text-stone-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Cargando seguimiento…</span>
      </div>
    );
  }

  if (error) {
    return <p className="py-4 text-xs text-red-500">{error}</p>;
  }

  if (!tracking) return null;

  return (
    /* layout de 2 columnas: contenido principal + widget ayuda */
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_200px]">

      {/* ── COLUMNA PRINCIPAL ── */}
      <div className="space-y-0">

        {/* Cabecera del panel de tracking */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-stone-900">
              Seguimiento del pedido <span className="font-mono">#{tracking.numero_pedido}</span>
            </p>
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
          </div>
          <button
            type="button"
            onClick={reload}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-400 transition hover:text-stone-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            Actualizar estado
          </button>
        </div>

        {/* Banner de estado */}
        <div className={`mb-4 relative overflow-hidden rounded-2xl px-5 py-4 ${
          isFailed
            ? 'bg-red-50 border border-red-100'
            : isDelivered
              ? 'bg-emerald-50 border border-emerald-100'
              : 'bg-stone-50 border border-stone-100'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
              isFailed ? 'bg-red-100' : isDelivered ? 'bg-emerald-100' : 'bg-stone-200'
            }`}>
              {isFailed
                ? <AlertCircle className="w-4 h-4 text-red-500" strokeWidth={2} />
                : isDelivered
                  ? <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
                  : <Package className="w-4 h-4 text-stone-500" strokeWidth={1.5} />
              }
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${
                isFailed ? 'text-red-800' : isDelivered ? 'text-emerald-800' : 'text-stone-900'
              }`}>
                {isDelivered ? '¡Pedido entregado!' : (LABELS[estadoNorm] ?? tracking.estado_pedido)}
              </p>
              <p className={`mt-0.5 text-xs leading-relaxed ${
                isFailed ? 'text-red-600' : isDelivered ? 'text-emerald-700' : 'text-stone-500'
              }`}>
                {STATUS_DESC[estadoNorm] ?? 'Tu pedido está siendo atendido.'}
              </p>
              {isDelivered && tracking.historial_pedido.find(h => h.status.toUpperCase() === 'DELIVERED') && (
                <p className="mt-0.5 text-xs text-emerald-600">
                  {formatFecha(tracking.historial_pedido.find(h => h.status.toUpperCase() === 'DELIVERED')!.created_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Barra de progreso con fechas */}
        {!isFailed && (
          <div className="mb-4 rounded-2xl border border-stone-100 bg-white px-5 py-5">
            <ProgressBar estado={tracking.estado_pedido} historial={tracking.historial_pedido} />
          </div>
        )}

        {/* Info de envío si hay guía */}
        {envio && (envio.transportadora || envio.numero_guia || envio.fecha_entrega_estimada) && (
          <div className="mb-4 rounded-2xl border border-stone-100 bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">Envío</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[10px] text-stone-400 mb-0.5">Transportadora</p>
                <p className="text-xs font-semibold text-stone-800">
                  {envio.transportadora?.nombre ?? <span className="font-normal text-stone-400">Por asignar</span>}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 mb-0.5">Guía</p>
                <p className="font-mono text-xs font-semibold text-stone-800">
                  {envio.numero_guia || <span className="font-normal text-stone-400">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 mb-0.5">Entrega estimada</p>
                <p className="text-xs font-semibold text-stone-800">
                  {envio.fecha_entrega_estimada ? formatFechaCorta(envio.fecha_entrega_estimada) : <span className="font-normal text-stone-400">Por confirmar</span>}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 mb-0.5">Tiempo</p>
                <p className="text-xs text-stone-600">2–5 días hábiles</p>
              </div>
            </div>
            {envio.tracking_url && (
              <a href={envio.tracking_url} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-100">
                <Truck className="w-3.5 h-3.5" strokeWidth={1.5} />
                Rastrear con {envio.transportadora?.nombre ?? 'transportadora'}
                <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
              </a>
            )}
          </div>
        )}

        {/* Dirección (si viene del envío y es diferente a la ya mostrada en el card) */}
        {(direccionMostrar || ciudadMostrar) && envio && (
          <div className="mb-4 rounded-2xl border border-stone-100 bg-white px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Dirección de envío</p>
            </div>
            <p className="text-xs text-stone-700 leading-relaxed">{direccionMostrar}</p>
            {ciudadMostrar && <p className="text-[11px] text-stone-400 mt-0.5">{ciudadMostrar}</p>}
          </div>
        )}

        {/* Historial de actividades */}
        {(tracking.historial_pedido.length > 0 || (envio?.eventos?.length ?? 0) > 0) && (
          <div className="rounded-2xl border border-stone-100 bg-white px-5 py-4">
            <p className="text-xs font-bold text-stone-800 mb-3">Historial de actividades</p>
            <EventTimeline
              historialPedido={tracking.historial_pedido}
              eventosEnvio={envio?.eventos ?? []}
            />
          </div>
        )}

        {/* Acciones secundarias */}
        {(hasPaid || onRepeatOrder) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {hasPaid && (
              <button onClick={handleViewInvoice} disabled={loadingInvoice}
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-40">
                {loadingInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />}
                Ver factura
              </button>
            )}
            {onRepeatOrder && (
              <button onClick={onRepeatOrder}
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50">
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                Repetir pedido
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── COLUMNA DERECHA: widget de ayuda ── */}
      <div className="lg:pt-[52px]">
        <HelpWidget onClose={onClose} />
      </div>
    </div>
  );
}
