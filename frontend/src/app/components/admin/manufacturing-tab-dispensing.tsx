import { useCallback, useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls } from './AdminUI';
import {
  exportDispensingOrder,
  getDispensingOrderByBatch,
  verifyDispensingLine,
  weighDispensingLine,
  type BatchRecord,
  type DispensingOrderRecord,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { getEmployeeName } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Orden de dispensación" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function DispensingTab({ batch, employeeById }: { batch: BatchRecord; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [order, setOrder] = useState<DispensingOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [weighModalLineId, setWeighModalLineId] = useState<string | null>(null);
  const [grossWeight, setGrossWeight] = useState('');
  const [tare, setTare] = useState('');
  const [container, setContainer] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDispensingOrderByBatch(batch.id);
      setOrder(result);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la dispensación');
    } finally {
      setLoading(false);
    }
  }, [batch.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleWeigh = async () => {
    if (!weighModalLineId) return;
    try {
      await weighDispensingLine(weighModalLineId, {
        gross_weight: Number(grossWeight),
        tare: Number(tare),
        container,
      });
      toast.success('Pesada registrada');
      setWeighModalLineId(null);
      setGrossWeight('');
      setTare('');
      setContainer('');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la pesada');
    }
  };

  const handleVerify = async (lineId: string) => {
    try {
      await verifyDispensingLine(lineId);
      toast.success('Línea verificada');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo verificar la línea');
    }
  };

  const handleExport = async () => {
    if (!order) return;
    try {
      await exportDispensingOrder(order.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar la orden de dispensación');
    }
  };

  if (loading) return <LoadingState label="Cargando dispensación..." />;
  if (!order) {
    return (
      <Card className="p-5">
        <EmptyState title="Sin orden de dispensación registrada para este lote" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Orden de dispensación</p>
          <p className="text-xs text-gray-400">
            Responsable: {getEmployeeName(employeeById.get(order.responsible ?? ''))} · Verificador: {getEmployeeName(employeeById.get(order.verifier ?? ''))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge label={order.status} color={order.status === 'COMPLETED' ? 'green' : 'yellow'} />
          <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Materia prima</th>
              <th className="py-2 pr-3">Teórica</th>
              <th className="py-2 pr-3">Pesada</th>
              <th className="py-2 pr-3">Desv. %</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-50">
                <td className="py-2 pr-3">{line.sequence}</td>
                <td className="py-2 pr-3">{line.item_name || line.item}</td>
                <td className="py-2 pr-3">{line.theoretical_quantity}</td>
                <td className="py-2 pr-3">{line.net_weight ?? '-'}</td>
                <td className={`py-2 pr-3 ${line.is_within_tolerance === false ? 'text-red-600 font-semibold' : ''}`}>
                  {line.deviation_percentage !== null ? `${line.deviation_percentage.toFixed(2)}%` : '-'}
                </td>
                <td className="py-2 pr-3">
                  <Badge label={line.status} color={line.status === 'VERIFIED' || line.status === 'CLOSED' ? 'green' : 'yellow'} />
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {line.status === 'PENDING' && (
                      <button onClick={() => setWeighModalLineId(line.id)} className="text-[#2a4038] hover:underline">Pesar</button>
                    )}
                    {line.status === 'WEIGHED' && (
                      <button onClick={() => void handleVerify(line.id)} className="text-[#2a4038] hover:underline">Verificar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Registrar pesada" open={Boolean(weighModalLineId)} onClose={() => setWeighModalLineId(null)}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tara</span>
            <input type="number" step="0.001" value={tare} onChange={(e) => setTare(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Peso bruto</span>
            <input type="number" step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Recipiente</span>
            <input value={container} onChange={(e) => setContainer(e.target.value)} className={inputCls} />
          </label>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setWeighModalLineId(null)}>Cancelar</SecondaryButton>
            <PrimaryButton onClick={() => void handleWeigh()}>Guardar pesada</PrimaryButton>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
