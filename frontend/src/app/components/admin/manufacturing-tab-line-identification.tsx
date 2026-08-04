import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Card, EmptyState, Modal, PrimaryButton, SecondaryButton, selectCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  createLineIdentification,
  exportLineIdentification,
  getLineIdentification,
  removeLineIdentification,
  type BatchRecord,
  type LineIdentificationRecord,
} from '../../services/manufacturing.service';
import { SectionField, formatDateTime, useAreasAndLines } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Identificación de línea" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function LineIdentificationTab({ batch }: { batch: BatchRecord }) {
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
