import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  authorizeWeightVolumeResume,
  createWeightVolumeControl,
  exportWeightVolumeControl,
  getWeightVolumeControl,
  recordWeightVolumeSample,
  type BatchRecord,
  type WeightVolumeControlRecord,
} from '../../services/manufacturing.service';
import { SectionField } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Control de peso o volumen" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function WeightVolumeTab({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [weight, setWeight] = useState<WeightVolumeControlRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [sampleForm, setSampleForm] = useState({ sampleNumber: '', grossWeight: '', tare: '' });
  const [savingSample, setSavingSample] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWeight(await getWeightVolumeControl(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRecordSample = async () => {
    if (!weight || !sampleForm.sampleNumber || !sampleForm.grossWeight || !sampleForm.tare) {
      toast.warning('Indica número de muestra, peso bruto y tara.');
      return;
    }
    setSavingSample(true);
    try {
      await recordWeightVolumeSample(weight.id, {
        sample_number: Number(sampleForm.sampleNumber),
        gross_weight: Number(sampleForm.grossWeight),
        tare: Number(sampleForm.tare),
      });
      toast.success('Muestra registrada');
      setSampleForm({ sampleNumber: '', grossWeight: '', tare: '' });
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la muestra');
    } finally {
      setSavingSample(false);
    }
  };

  const handleAuthorizeResume = async () => {
    if (!weight) return;
    setAuthorizing(true);
    try {
      await authorizeWeightVolumeResume(weight.id);
      toast.success('Reanudación autorizada');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo autorizar la reanudación');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleExportWeight = async () => {
    if (!weight) return;
    try {
      await exportWeightVolumeControl(weight.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el control de peso/volumen');
    }
  };

  if (loading) return <LoadingState label="Cargando control de peso o volumen..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Control de peso o volumen</p>
          {weight ? (
            <SecondaryButton onClick={() => void handleExportWeight()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
          ) : (
            <SecondaryButton onClick={() => setShowWeightModal(true)} icon={<Plus size={13} />}>Nuevo</SecondaryButton>
          )}
        </div>
        {!weight ? <EmptyState title="Sin registro" /> : (
          <div className="space-y-3">
            <Badge label={weight.overall_result} color={weight.overall_result === 'APPROVED' ? 'green' : weight.overall_result === 'REJECTED' ? 'red' : 'yellow'} />
            <SectionField label="Límite inferior" value={weight.lower_limit ?? '-'} />
            <SectionField label="Límite superior" value={weight.upper_limit ?? '-'} />
            <p className="text-xs text-gray-400">{weight.samples.length} muestra(s) registradas</p>

            {weight.overall_result === 'REJECTED' && !weight.resumed_authorized_by && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-2">Bloqueado por muestra fuera de especificación</p>
                <SecondaryButton onClick={() => void handleAuthorizeResume()} disabled={authorizing}>
                  {authorizing ? 'Autorizando...' : 'Autorizar reanudación'}
                </SecondaryButton>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
              <input
                type="number"
                placeholder="N° muestra"
                value={sampleForm.sampleNumber}
                onChange={(e) => setSampleForm((f) => ({ ...f, sampleNumber: e.target.value }))}
                className={inputCls}
              />
              <input
                type="number"
                placeholder="Peso bruto"
                value={sampleForm.grossWeight}
                onChange={(e) => setSampleForm((f) => ({ ...f, grossWeight: e.target.value }))}
                className={inputCls}
              />
              <input
                type="number"
                placeholder="Tara"
                value={sampleForm.tare}
                onChange={(e) => setSampleForm((f) => ({ ...f, tare: e.target.value }))}
                className={inputCls}
              />
            </div>
            <SecondaryButton
              onClick={() => void handleRecordSample()}
              disabled={savingSample || (weight.overall_result === 'REJECTED' && !weight.resumed_authorized_by)}
              icon={<Plus size={13} />}
            >
              {savingSample ? 'Registrando...' : 'Registrar muestra'}
            </SecondaryButton>
            <SignatureBlock resourcePath="weight-volume-controls" resourceId={weight.id} role="RESPONSIBLE" label="Realizado por" />
            <SignatureBlock resourcePath="weight-volume-controls" resourceId={weight.id} role="VERIFIER" label="Verificado por" />
          </div>
        )}
      </Card>

      <NewWeightVolumeControlModal
        open={showWeightModal}
        batchId={batch.id}
        onClose={() => setShowWeightModal(false)}
        onCreated={async () => {
          setShowWeightModal(false);
          await load();
        }}
      />
    </div>
  );
}

export function NewWeightVolumeControlModal({
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
  const [lowerLimit, setLowerLimit] = useState('');
  const [upperLimit, setUpperLimit] = useState('');
  const [tare, setTare] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createWeightVolumeControl({
        batch: batchId,
        tare: tare ? Number(tare) : null,
        lower_limit: lowerLimit ? Number(lowerLimit) : null,
        upper_limit: upperLimit ? Number(upperLimit) : null,
      });
      toast.success('Control de peso o volumen creado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el control');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo control de peso o volumen" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tara</span>
          <input type="number" step="0.001" value={tare} onChange={(e) => setTare(e.target.value)} className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Límite inferior</span>
            <input type="number" step="0.001" value={lowerLimit} onChange={(e) => setLowerLimit(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Límite superior</span>
            <input type="number" step="0.001" value={upperLimit} onChange={(e) => setUpperLimit(e.target.value)} className={inputCls} />
          </label>
        </div>
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
