import { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { Card, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import {
  changeBatchStatus,
  type BatchRecord,
  type BatchStatus,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import {
  STATUS_LABELS,
  SectionField,
  formatDate,
  formatDateTime,
  getEmployeeName,
} from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Información general de la orden" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function GeneralTab({
  batch,
  employeeById,
  onRefresh,
}: {
  batch: BatchRecord;
  employeeById: Map<string, Employee>;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState<BatchStatus>(batch.status);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangeStatus = async () => {
    setSaving(true);
    try {
      await changeBatchStatus(batch.id, { status: nextStatus, reason });
      toast.success('Estado actualizado');
      setShowStatusModal(false);
      setReason('');
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">Datos de la orden</p>
          {!batch.is_terminal && (
            <SecondaryButton onClick={() => setShowStatusModal(true)}>Cambiar estado</SecondaryButton>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionField label="Orden de producción" value={batch.production_order_number} />
          <SectionField label="Lote" value={batch.batch_code || 'Sin asignar'} />
          <SectionField label="Estado" value={STATUS_LABELS[batch.status]} />
          <SectionField label="Área" value={batch.area_name || 'Sin asignar'} />
          <SectionField label="Línea" value={batch.production_line_name || 'Sin asignar'} />
          <SectionField label="Responsable de producción" value={getEmployeeName(employeeById.get(batch.production_manager ?? ''))} />
          <SectionField label="Responsable de calidad" value={getEmployeeName(employeeById.get(batch.quality_manager ?? ''))} />
          <SectionField label="Fecha programada" value={formatDate(batch.scheduled_at)} />
          <SectionField label="Fecha real de inicio" value={formatDateTime(batch.actual_start_at)} />
          <SectionField label="Fecha real de terminación" value={formatDateTime(batch.actual_end_at)} />
        </div>
        {batch.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <SectionField label="Observaciones" value={batch.notes} />
          </div>
        )}
      </Card>

      <Modal title="Cambiar estado del lote" open={showStatusModal} onClose={() => setShowStatusModal(false)}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nuevo estado</span>
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as BatchStatus)} className={selectCls}>
              {Object.entries(STATUS_LABELS)
                .filter(([value]) => value !== 'RELEASED')
                .map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
            </select>
            <span className="block text-[11px] text-gray-400 mt-1">
              Para liberar el lote usa la pestaña "Liberación", que valida certificado de análisis, hermeticidad, peso/volumen y documentos.
            </span>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Motivo</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </label>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowStatusModal(false)}>Cancelar</SecondaryButton>
            <PrimaryButton onClick={() => void handleChangeStatus()} disabled={saving}>
              {saving ? 'Guardando...' : 'Confirmar cambio'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
