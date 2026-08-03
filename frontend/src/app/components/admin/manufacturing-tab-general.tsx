import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Card, EmptyState, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  changeBatchStatus,
  createLineIdentification,
  exportLineIdentification,
  getLineIdentification,
  removeLineIdentification,
  type BatchRecord,
  type BatchStatus,
  type LineIdentificationRecord,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import {
  STATUS_LABELS,
  SectionField,
  formatDate,
  formatDateTime,
  getEmployeeName,
  useAreasAndLines,
} from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Información general" del expediente de lote.
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

      <LineIdentificationSection batch={batch} />

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

function LineIdentificationSection({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [lineIdentification, setLineIdentification] = useState<LineIdentificationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLineModal, setShowLineModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLineIdentification(await getLineIdentification(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    if (!lineIdentification) return;
    try {
      await exportLineIdentification(lineIdentification.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemove = async () => {
    if (!lineIdentification) return;
    setRemoving(true);
    try {
      await removeLineIdentification(lineIdentification.id);
      toast.success('Identificación de línea retirada');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo retirar la identificación');
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Identificación de línea</p>
        {lineIdentification ? (
          <div className="flex items-center gap-2">
            {!lineIdentification.removed_at && (
              <SecondaryButton onClick={() => void handleRemove()} disabled={removing}>
                {removing ? 'Retirando...' : 'Retirar'}
              </SecondaryButton>
            )}
            <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
          </div>
        ) : (
          <SecondaryButton onClick={() => setShowLineModal(true)} icon={<Plus size={13} />}>Registrar</SecondaryButton>
        )}
      </div>
      {lineIdentification ? (
        <>
          <div className="grid sm:grid-cols-2 gap-4 mb-3">
            <SectionField label="Área" value={lineIdentification.area_name || 'Sin asignar'} />
            <SectionField label="Línea" value={lineIdentification.production_line_name || 'Sin asignar'} />
            <SectionField label="Colocada" value={formatDateTime(lineIdentification.placed_at)} />
            <SectionField label="Retirada" value={formatDateTime(lineIdentification.removed_at)} />
          </div>
          <SignatureBlock resourcePath="line-identifications" resourceId={lineIdentification.id} role="RESPONSIBLE" label="Colocada por" />
        </>
      ) : (
        <EmptyState title="Sin identificación de línea registrada" />
      )}

      <NewLineIdentificationModal
        open={showLineModal}
        batchId={batch.id}
        onClose={() => setShowLineModal(false)}
        onCreated={async () => {
          setShowLineModal(false);
          await load();
        }}
      />
    </Card>
  );
}

function NewLineIdentificationModal({
  open,
  batchId,
  onClose,
  onCreated,
}: {
  open: boolean;
  batchId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const { areas, productionLines } = useAreasAndLines();
  const [area, setArea] = useState('');
  const [productionLine, setProductionLine] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createLineIdentification({
        batch: batchId,
        area: area || null,
        production_line: productionLine || null,
        placed_at: new Date().toISOString(),
      });
      toast.success('Identificación de línea registrada');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la identificación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Identificación de línea" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Área</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={selectCls}>
            <option value="">Sin asignar</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Línea</span>
          <select value={productionLine} onChange={(e) => setProductionLine(e.target.value)} className={selectCls}>
            <option value="">Sin asignar</option>
            {productionLines.map((line) => (
              <option key={line.id} value={line.id}>{line.name}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

