import { useCallback, useEffect, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls } from './AdminUI';
import {
  createRawMaterialIdentificationPrint,
  exportDispensingOrder,
  exportRawMaterialIdentification,
  getDispensingOrderByBatch,
  getRawMaterialIdentificationPrints,
  verifyDispensingLine,
  weighDispensingLine,
  type BatchRecord,
  type DispensingLineRecord,
  type DispensingOrderRecord,
  type RawMaterialIdentificationPrintRecord,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { getEmployeeName, getMediaUrl, formatDateTime, SectionField } from './manufacturing-shared';
import { PhaseClearanceAndCleaningSection } from './manufacturing-clearance';

/* ═══════════════════════════════════════════════════════
   Pestaña "Dispensación" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function DispensingTab({ batch, employeeById }: { batch: BatchRecord; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [order, setOrder] = useState<DispensingOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [weighModalLineId, setWeighModalLineId] = useState<string | null>(null);
  const [grossWeight, setGrossWeight] = useState('');
  const [tare, setTare] = useState('');
  const [container, setContainer] = useState('');
  const [identificationLine, setIdentificationLine] = useState<DispensingLineRecord | null>(null);

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
      <div className="space-y-4">
        <Card className="p-5">
          <EmptyState title="Sin orden de dispensación registrada para este lote" />
        </Card>
        <PhaseClearanceAndCleaningSection batch={batch} phase="DISPENSING" phaseLabel="Dispensación" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                      {line.status !== 'PENDING' && (
                        <button
                          onClick={() => setIdentificationLine(line)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          title="Identificación de materia prima"
                        >
                          <Printer size={13} />
                        </button>
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

        {identificationLine && (
          <RawMaterialIdentificationModal
            line={identificationLine}
            batch={batch}
            onClose={() => setIdentificationLine(null)}
          />
        )}
      </Card>

      <PhaseClearanceAndCleaningSection batch={batch} phase="DISPENSING" phaseLabel="Dispensación" />
    </div>
  );
}

function RawMaterialIdentificationModal({
  line,
  batch,
  onClose,
}: {
  line: DispensingLineRecord;
  batch: BatchRecord;
  onClose: () => void;
}) {
  const toast = useToast();
  const [prints, setPrints] = useState<RawMaterialIdentificationPrintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprintReason, setReprintReason] = useState('');
  const [labelPhoto, setLabelPhoto] = useState<File | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPrints(await getRawMaterialIdentificationPrints(line.id));
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el historial de impresión');
    } finally {
      setLoading(false);
    }
  }, [line.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPrinted = prints.length > 0;

  const handlePrint = async () => {
    if (hasPrinted && !reprintReason.trim()) {
      toast.warning('Indica el motivo de la reimpresión.');
      return;
    }
    if (!labelPhoto) {
      toast.warning('Adjunta la foto del rótulo de la materia prima antes de continuar.');
      return;
    }
    setPrinting(true);
    try {
      const created = await createRawMaterialIdentificationPrint({
        dispensing_line: line.id,
        is_reprint: hasPrinted,
        reprint_reason: hasPrinted ? reprintReason : '',
        label_photo: labelPhoto,
      });
      await exportRawMaterialIdentification(created.id, batch.batch_code || batch.production_order_number);
      toast.success(hasPrinted ? 'Reimpresión registrada' : 'Identificación impresa');
      setReprintReason('');
      setLabelPhoto(null);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo generar la identificación');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal title="Identificación de materia prima dispensada" open onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <SectionField label="Materia prima" value={line.item_name || line.item} />
          <SectionField label="Lote de materia prima" value={line.raw_material_batch_code || '-'} />
          <SectionField label="Tara" value={line.tare ?? '-'} />
          <SectionField label="Peso bruto" value={line.gross_weight ?? '-'} />
          <SectionField label="Peso neto" value={line.net_weight ?? '-'} />
          <SectionField label="Recipiente" value={line.container || '-'} />
          <SectionField label="Fecha y hora de pesada" value={formatDateTime(line.weighed_at)} />
          <SectionField label="Estado" value={line.status} />
        </div>

        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-2">Historial de impresión</p>
          {loading ? (
            <p className="text-xs text-gray-400">Cargando...</p>
          ) : prints.length === 0 ? (
            <p className="text-xs text-gray-400">Aún no se ha impreso esta identificación.</p>
          ) : (
            <div className="space-y-2">
              {prints.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 text-xs border-b border-gray-50 pb-2">
                  <div className="flex items-center gap-2">
                    {entry.label_photo && (
                      <img
                        src={getMediaUrl(entry.label_photo)}
                        alt="Rótulo de materia prima"
                        className="h-10 w-10 object-cover rounded border border-gray-200"
                      />
                    )}
                    <span>{entry.is_reprint ? `Reimpresión — ${entry.reprint_reason || 'sin motivo'}` : 'Impresión original'}</span>
                  </div>
                  <span className="text-gray-400">{formatDateTime(entry.printed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-2">Paso 2 · Foto del rótulo de la materia prima</p>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Foto del rótulo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLabelPhoto(e.target.files?.[0] ?? null)}
              className={inputCls}
            />
            <p className="text-[11px] text-gray-400 mt-1">Requerida para imprimir o reimprimir la identificación.</p>
          </label>
        </div>

        {hasPrinted && (
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Motivo de reimpresión</span>
            <input value={reprintReason} onChange={(e) => setReprintReason(e.target.value)} className={inputCls} placeholder="Requerido para reimprimir" />
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cerrar</SecondaryButton>
          <PrimaryButton onClick={() => void handlePrint()} disabled={printing} icon={<Printer size={14} />}>
            {printing ? 'Generando...' : hasPrinted ? 'Reimprimir' : 'Imprimir / Descargar PDF'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

