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
import { inputCls, selectCls } from './AdminUI';

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
        className="mt-3 inline-flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Truck size={14} />
        Registrar guía
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 border border-gray-100 bg-gray-50 rounded-xl p-4 md:grid-cols-2">
      <select
        value={carrierId}
        onChange={event => setCarrierId(event.target.value)}
        required
        className={selectCls}
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
        className={inputCls}
      />
      <input
        type="url"
        value={trackingUrl}
        onChange={event => setTrackingUrl(event.target.value)}
        placeholder="URL de rastreo (opcional)"
        className={inputCls}
      />
      <input
        type="number"
        min="0"
        value={shippingCost}
        onChange={event => setShippingCost(event.target.value)}
        placeholder="Costo de envío"
        className={inputCls}
      />
      <input
        type="date"
        value={estimatedDate}
        onChange={event => setEstimatedDate(event.target.value)}
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !carrierId}
          className="bg-[#2a4038] rounded-xl px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar guía'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
