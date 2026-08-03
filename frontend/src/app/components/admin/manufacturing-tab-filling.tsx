import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  authorizeWeightVolumeResume,
  createFillingControl,
  exportFillingControl,
  exportSealIntegrityControl,
  exportWeightVolumeControl,
  getFillingControl,
  getSealIntegrityControl,
  getWeightVolumeControl,
  recordWeightVolumeSample,
  type BatchRecord,
  type FillingControlRecord,
  type SealIntegrityControlRecord,
  type WeightVolumeControlRecord,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { formatDateTime, SectionField, useAreasAndLines } from './manufacturing-shared';
import { PhaseClearanceAndCleaningSection } from './manufacturing-clearance';
import { NewSealIntegrityControlModal, NewWeightVolumeControlModal } from './manufacturing-tab-packaging';

/* ═══════════════════════════════════════════════════════
   Pestaña "Llenado" del expediente de lote.
═══════════════════════════════════════════════════════ */

function FillingSealAndWeightSection({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [seal, setSeal] = useState<SealIntegrityControlRecord | null>(null);
  const [weight, setWeight] = useState<WeightVolumeControlRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSealModal, setShowSealModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [sampleForm, setSampleForm] = useState({ sampleNumber: '', grossWeight: '', tare: '' });
  const [savingSample, setSavingSample] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sealRes, weightRes] = await Promise.allSettled([
        getSealIntegrityControl(batch.id),
        getWeightVolumeControl(batch.id),
      ]);
      if (sealRes.status === 'fulfilled') setSeal(sealRes.value);
      if (weightRes.status === 'fulfilled') setWeight(weightRes.value);
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

  const handleExportSeal = async () => {
    if (!seal) return;
    try {
      await exportSealIntegrityControl(seal.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el control de hermeticidad');
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

  if (loading) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
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

      <NewSealIntegrityControlModal
        open={showSealModal}
        batchId={batch.id}
        onClose={() => setShowSealModal(false)}
        onCreated={async () => {
          setShowSealModal(false);
          await load();
        }}
      />
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

      <PhaseClearanceAndCleaningSection batch={batch} phase="FILLING" phaseLabel="Llenado" />
      <FillingSealAndWeightSection batch={batch} />
    </div>
  );
}

