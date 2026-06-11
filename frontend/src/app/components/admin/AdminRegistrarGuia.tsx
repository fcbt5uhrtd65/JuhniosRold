import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Truck } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  crearEnvio,
  getTrackingPedido,
  getTransportadoras,
  registrarGuiaManual,
  type Transportadora,
} from '../../services/enviosApi';

export function AdminRegistrarGuia({
  pedidoId,
  onSaved,
}: {
  pedidoId: string;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [carriers, setCarriers] = useState<Transportadora[]>([]);
  const [carrierId, setCarrierId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || carriers.length > 0) return;
    void getTransportadoras()
      .then(items => {
        setCarriers(items);
        setCarrierId(items[0]?.id ?? '');
      })
      .catch(error => {
        toast.error(error instanceof Error ? error.message : 'No fue posible cargar transportadoras.');
      });
  }, [open, carriers.length, toast]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const tracking = await getTrackingPedido(pedidoId);
      const shipment = tracking.envio ?? await crearEnvio({ pedido_id: pedidoId });
      await registrarGuiaManual(shipment.id, {
        transportadora_id: carrierId,
        numero_guia: trackingNumber,
        tracking_url: trackingUrl,
        ...(shippingCost ? { costo_envio: Number(shippingCost) } : {}),
        ...(estimatedDate
          ? { fecha_entrega_estimada: new Date(`${estimatedDate}T12:00:00`).toISOString() }
          : {}),
      });
      toast.success('Guía registrada y pedido marcado como despachado.');
      setOpen(false);
      setTrackingNumber('');
      setTrackingUrl('');
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible registrar la guía.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-border px-3 py-2 text-[10px] uppercase tracking-wider hover:bg-background"
      >
        <Truck className="w-4 h-4" strokeWidth={1} />
        Registrar guía
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 border border-border bg-background p-4 md:grid-cols-2">
      <select
        value={carrierId}
        onChange={event => setCarrierId(event.target.value)}
        required
        className="border border-border bg-background px-3 py-2 text-xs"
      >
        {carriers.map(carrier => (
          <option key={carrier.id} value={carrier.id}>{carrier.nombre}</option>
        ))}
      </select>
      <input
        value={trackingNumber}
        onChange={event => setTrackingNumber(event.target.value)}
        required
        minLength={3}
        placeholder="Número de guía"
        className="border border-border bg-background px-3 py-2 text-xs"
      />
      <input
        type="url"
        value={trackingUrl}
        onChange={event => setTrackingUrl(event.target.value)}
        placeholder="URL de rastreo (opcional)"
        className="border border-border bg-background px-3 py-2 text-xs"
      />
      <input
        type="number"
        min="0"
        value={shippingCost}
        onChange={event => setShippingCost(event.target.value)}
        placeholder="Costo de envío"
        className="border border-border bg-background px-3 py-2 text-xs"
      />
      <input
        type="date"
        value={estimatedDate}
        onChange={event => setEstimatedDate(event.target.value)}
        className="border border-border bg-background px-3 py-2 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !carrierId}
          className="bg-foreground px-4 py-2 text-[10px] uppercase tracking-wider text-background disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar guía'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border border-border px-4 py-2 text-[10px] uppercase tracking-wider"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
