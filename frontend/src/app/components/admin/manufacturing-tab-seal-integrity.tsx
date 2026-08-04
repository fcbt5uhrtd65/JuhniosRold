import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  createSealIntegrityControl,
  exportSealIntegrityControl,
  getSealIntegrityControl,
  type BatchRecord,
  type SealIntegrityControlRecord,
} from '../../services/manufacturing.service';
import { SectionField } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Control de hermeticidad" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function SealIntegrityTab({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [seal, setSeal] = useState<SealIntegrityControlRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSealModal, setShowSealModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSeal(await getSealIntegrityControl(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExportSeal = async () => {
    if (!seal) return;
    try {
      await exportSealIntegrityControl(seal.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el control de hermeticidad');
    }
  };

  if (loading) return <LoadingState label="Cargando control de hermeticidad..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Control de hermeticidad</p>
            <p className="text-[11px] text-gray-400">No todos los productos requieren esta prueba.</p>
          </div>
          {seal ? (
            <SecondaryButton onClick={() => void handleExportSeal()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
          ) : (
            <SecondaryButton onClick={() => setShowSealModal(true)} icon={<Plus size={13} />}>Nuevo</SecondaryButton>
          )}
        </div>
        {!seal ? <EmptyState title="Sin registro" description="Puedes marcar 'No aplica' si el producto no requiere prueba de hermeticidad." /> : (
          <div className="space-y-2">
            <Badge
              label={seal.overall_result === 'NOT_APPLICABLE' ? 'No aplica' : seal.overall_result}
              color={seal.overall_result === 'APPROVED' ? 'green' : seal.overall_result === 'REJECTED' ? 'red' : seal.overall_result === 'NOT_APPLICABLE' ? 'gray' : 'yellow'}
            />
            {seal.overall_result !== 'NOT_APPLICABLE' && (
              <>
                <SectionField label="Presión (bar)" value={seal.pressure_bar ?? '-'} />
                <SectionField label="Tiempo (s)" value={String(seal.time_seconds ?? '-')} />
              </>
            )}
            <SignatureBlock resourcePath="seal-integrity-controls" resourceId={seal.id} role="RESPONSIBLE" label="Realizado por" />
            <SignatureBlock resourcePath="seal-integrity-controls" resourceId={seal.id} role="VERIFIER" label="Verificado por" />
          </div>
        )}
      </Card>

      <NewSealIntegrityControlModal
        open={showSealModal}
        batchId={batch.id}
        onClose={() => setShowSealModal(false)}
        onCreated={async () => {
          setShowSealModal(false);
          await load();
        }}
      />
    </div>
  );
}

export function NewSealIntegrityControlModal({
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
  const [notApplicable, setNotApplicable] = useState(false);
  const [equipment, setEquipment] = useState('');
  const [pressureBar, setPressureBar] = useState('');
  const [timeSeconds, setTimeSeconds] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createSealIntegrityControl({
        batch: batchId,
        tested_at: notApplicable ? null : new Date().toISOString(),
        equipment: notApplicable ? '' : equipment,
        pressure_bar: notApplicable || !pressureBar ? null : Number(pressureBar),
        time_seconds: notApplicable || !timeSeconds ? null : Number(timeSeconds),
        overall_result: notApplicable ? 'NOT_APPLICABLE' : undefined,
      });
      toast.success('Control de hermeticidad creado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el control');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo control de hermeticidad" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={notApplicable} onChange={(e) => setNotApplicable(e.target.checked)} />
          Este producto no requiere prueba de hermeticidad (No aplica)
        </label>
        {!notApplicable && (
          <>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Equipo</span>
              <input value={equipment} onChange={(e) => setEquipment(e.target.value)} className={inputCls} />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Presión (bar)</span>
                <input type="number" step="0.01" value={pressureBar} onChange={(e) => setPressureBar(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tiempo (segundos)</span>
                <input type="number" value={timeSeconds} onChange={(e) => setTimeSeconds(e.target.value)} className={inputCls} />
              </label>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear control'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
