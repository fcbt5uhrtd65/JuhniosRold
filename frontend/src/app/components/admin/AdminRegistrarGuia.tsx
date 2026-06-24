import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  crearEnvio,
  crearTransportadora,
  getTrackingPedido,
  getTransportadoras,
  registrarGuiaManual,
  type Transportadora,
} from '../../services/enviosApi';
import { inputCls, selectCls } from './AdminUI';

const NEW_CARRIER_SENTINEL = '__new__';

export function AdminRegistrarGuia({
  pedidoId,
  onSaved,
  onCancel,
}: {
  pedidoId: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [carriers, setCarriers] = useState<Transportadora[]>([]);
  const [carrierId, setCarrierId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [saving, setSaving] = useState(false);

  // Fields for creating a new carrier inline
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCode, setNewCarrierCode] = useState('');
  const [creatingCarrier, setCreatingCarrier] = useState(false);

  const isNewCarrier = carrierId === NEW_CARRIER_SENTINEL;

  useEffect(() => {
    void getTransportadoras()
      .then(items => {
        setCarriers(items);
        setCarrierId(items[0]?.id ?? NEW_CARRIER_SENTINEL);
      })
      .catch(error => {
        toast.error(error instanceof Error ? error.message : 'No fue posible cargar transportadoras.');
      });
  }, [toast]);

  const handleCreateCarrier = async (): Promise<string | null> => {
    if (!newCarrierName.trim() || !newCarrierCode.trim()) {
      toast.error('Ingresa el nombre y el código de la transportadora.');
      return null;
    }
    setCreatingCarrier(true);
    try {
      const created = await crearTransportadora({
        codigo: newCarrierCode.trim().toUpperCase(),
        nombre: newCarrierName.trim(),
      });
      setCarriers(prev => [...prev, created]);
      setCarrierId(created.id);
      return created.id;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible crear la transportadora.');
      return null;
    } finally {
      setCreatingCarrier(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      let resolvedCarrierId = carrierId;

      if (isNewCarrier) {
        const created = await handleCreateCarrier();
        if (!created) {
          setSaving(false);
          return;
        }
        resolvedCarrierId = created;
      }

      const tracking = await getTrackingPedido(pedidoId);
      const shipment = tracking.envio ?? await crearEnvio({ pedido_id: pedidoId });
      await registrarGuiaManual(shipment.id, {
        transportadora_id: resolvedCarrierId,
        numero_guia: trackingNumber,
        tracking_url: trackingUrl,
        ...(shippingCost ? { costo_envio: Number(shippingCost) } : {}),
        ...(estimatedDate
          ? { fecha_entrega_estimada: new Date(`${estimatedDate}T12:00:00`).toISOString() }
          : {}),
      });
      toast.success('Guía registrada. El pedido ha sido marcado como Enviado.');
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible registrar la guía.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border border-[#2a4038]/20 bg-[#2a4038]/5 rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#2a4038]">Registrar guía de envío</p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Transportadora</label>
          <select
            value={carrierId}
            onChange={event => setCarrierId(event.target.value)}
            required
            className={selectCls}
          >
            {carriers.map(carrier => (
              <option key={carrier.id} value={carrier.id}>{carrier.nombre}</option>
            ))}
            <option value={NEW_CARRIER_SENTINEL}>
              + Registrar nueva transportadora
            </option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Número de guía</label>
          <input
            value={trackingNumber}
            onChange={event => setTrackingNumber(event.target.value)}
            required
            minLength={3}
            placeholder="Número de guía"
            className={inputCls}
          />
        </div>

        {isNewCarrier && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <Plus size={10} className="inline mr-1" />
                Nombre de la nueva transportadora
              </label>
              <input
                value={newCarrierName}
                onChange={event => setNewCarrierName(event.target.value)}
                placeholder="Ej. Servientrega"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Código interno</label>
              <input
                value={newCarrierCode}
                onChange={event => setNewCarrierCode(event.target.value)}
                placeholder="Ej. SERVIENTREGA"
                className={inputCls}
              />
            </div>
          </>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">URL de rastreo (opcional)</label>
          <input
            type="url"
            value={trackingUrl}
            onChange={event => setTrackingUrl(event.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Costo de envío</label>
          <input
            type="number"
            min="0"
            value={shippingCost}
            onChange={event => setShippingCost(event.target.value)}
            placeholder="Costo de envío"
            className={inputCls}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fecha estimada de entrega</label>
          <input
            type="date"
            value={estimatedDate}
            onChange={event => setEstimatedDate(event.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || creatingCarrier || !carrierId || (isNewCarrier && (!newCarrierName.trim() || !newCarrierCode.trim()))}
          className="bg-[#2a4038] rounded-xl px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
        >
          {saving || creatingCarrier ? 'Guardando...' : 'Confirmar envío'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
