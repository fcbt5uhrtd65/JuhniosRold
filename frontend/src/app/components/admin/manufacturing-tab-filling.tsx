import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  createFillingControl,
  exportFillingControl,
  getFillingControl,
  type BatchRecord,
  type FillingControlRecord,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { formatDateTime, SectionField, useAreasAndLines } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Control de llenado" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function FillingTab({ batch, employeeById }: { batch: BatchRecord; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const { productionLines } = useAreasAndLines();
  const [control, setControl] = useState<FillingControlRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [productionLine, setProductionLine] = useState('');
  const [equipment, setEquipment] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setControl(await getFillingControl(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createFillingControl({
        batch: batch.id,
        production_line: productionLine || null,
        equipment,
        started_at: new Date().toISOString(),
        planned_quantity: plannedQuantity ? Number(plannedQuantity) : null,
      });
      toast.success('Control de llenado creado');
      setShowModal(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el control de llenado');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!control) return;
    try {
      await exportFillingControl(control.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el control de llenado');
    }
  };

  if (loading) return <LoadingState label="Cargando llenado..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Control de llenado</p>
          {control ? (
            <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
          ) : (
            <SecondaryButton onClick={() => setShowModal(true)} icon={<Plus size={13} />}>Nuevo control</SecondaryButton>
          )}
        </div>
        {!control ? (
          <EmptyState title="Sin control de llenado registrado" />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <SectionField label="Línea" value={control.production_line_name || '-'} />
              <SectionField label="Programado" value={control.planned_quantity ?? '-'} />
              <SectionField label="Producido" value={control.produced_quantity} />
              <SectionField label="Rendimiento" value={control.yield_percentage !== null ? `${control.yield_percentage.toFixed(1)}%` : '-'} />
            </div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Personal participante</p>
            <div className="space-y-1.5">
              {control.participants.length === 0 ? (
                <p className="text-xs text-gray-400">Sin personal registrado.</p>
              ) : (
                control.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between text-xs border-b border-gray-50 pb-1.5">
                    <span>{participant.activity || participant.role}</span>
                    <span className="text-gray-400">{formatDateTime(participant.check_in)} - {formatDateTime(participant.check_out)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100">
              <SignatureBlock resourcePath="filling-controls" resourceId={control.id} role="RESPONSIBLE" label="Responsable" />
              <SignatureBlock resourcePath="filling-controls" resourceId={control.id} role="VERIFIER" label="Verificador" />
            </div>
          </>
        )}

        <Modal title="Nuevo control de llenado" open={showModal} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Línea</span>
              <select value={productionLine} onChange={(e) => setProductionLine(e.target.value)} className={selectCls}>
                <option value="">Sin asignar</option>
                {productionLines.map((line) => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Equipo</span>
              <input value={equipment} onChange={(e) => setEquipment(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Cantidad programada</span>
              <input type="number" value={plannedQuantity} onChange={(e) => setPlannedQuantity(e.target.value)} className={inputCls} />
            </label>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setShowModal(false)}>Cancelar</SecondaryButton>
              <PrimaryButton onClick={() => void handleCreate()} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear control'}
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      </Card>
    </div>
  );
}
