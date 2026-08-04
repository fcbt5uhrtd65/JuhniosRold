import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  createBatchLotMarking,
  createPackagingControl,
  exportPackagingControl,
  getPackagingControl,
  updatePackagingControlLabel,
  type BatchRecord,
  type PackagingControlRecord,
  type ResultStatus,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { getEmployeeName, getMediaUrl, SectionField } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Control de acondicionamiento" del expediente de
   lote (etiqueta testigo, loteado inicial y final).
═══════════════════════════════════════════════════════ */

export function PackagingControlTab({
  batch,
  employeeById,
  employees,
}: {
  batch: BatchRecord;
  employeeById: Map<string, Employee>;
  employees: Employee[];
}) {
  const toast = useToast();
  const [control, setControl] = useState<PackagingControlRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPackagingModal, setShowPackagingModal] = useState(false);
  const [showLotMarkingModal, setShowLotMarkingModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setControl(await getPackagingControl(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExportPackaging = async () => {
    if (!control) return;
    try {
      await exportPackagingControl(control.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el control de acondicionamiento');
    }
  };

  if (loading) return <LoadingState label="Cargando acondicionamiento..." />;

  return (
    <div className="space-y-4">
      {control && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Etiqueta testigo</p>
            <SecondaryButton onClick={() => setShowLabelModal(true)} icon={<Plus size={13} />}>
              {control.label_code || control.label_sample_file ? 'Editar' : 'Registrar'}
            </SecondaryButton>
          </div>
          {!control.label_code && !control.label_sample_file ? (
            <EmptyState title="Sin etiqueta testigo registrada" />
          ) : (
            <div className="grid sm:grid-cols-[1fr_auto] gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <SectionField label="Código de etiqueta" value={control.label_code || '-'} />
                <SectionField label="Versión del arte" value={control.artwork_version || '-'} />
                <SectionField label="Lote del material" value={control.label_material_batch || '-'} />
                <SectionField label="Resultado" value={control.label_result || '-'} />
                {control.label_observations && (
                  <div className="sm:col-span-2">
                    <SectionField label="Observaciones" value={control.label_observations} />
                  </div>
                )}
              </div>
              {control.label_sample_file && (
                <img
                  src={getMediaUrl(control.label_sample_file)}
                  alt="Etiqueta testigo"
                  className="h-24 w-24 object-cover rounded-lg border border-gray-200"
                />
              )}
            </div>
          )}
          {(control.label_performed_by || control.label_verified_by) && (
            <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-gray-100">
              <SectionField label="Realizado por" value={getEmployeeName(employeeById.get(control.label_performed_by ?? ''))} />
              <SectionField label="Verificado por" value={getEmployeeName(employeeById.get(control.label_verified_by ?? ''))} />
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Control de acondicionamiento</p>
          {control ? (
            <SecondaryButton onClick={() => void handleExportPackaging()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
          ) : (
            <SecondaryButton onClick={() => setShowPackagingModal(true)} icon={<Plus size={13} />}>Nuevo control</SecondaryButton>
          )}
        </div>
        {!control ? (
          <EmptyState title="Sin control de acondicionamiento registrado" />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <SectionField label="Cajas completas" value={String(control.complete_boxes)} />
              <SectionField label="Displays incompletos" value={String(control.incomplete_displays)} />
              <SectionField label="Unidades sueltas" value={String(control.loose_units)} />
              <SectionField label="Total conciliado" value={control.total_reconciled} />
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">Loteado</p>
              <button onClick={() => setShowLotMarkingModal(true)} className="text-xs text-[#2a4038] font-semibold hover:underline flex items-center gap-1">
                <Plus size={12} /> Registrar loteado
              </button>
            </div>
            <div className="space-y-2">
              {control.lot_markings.length === 0 ? (
                <p className="text-xs text-gray-400">Sin registros de loteado.</p>
              ) : (
                control.lot_markings.map((marking) => (
                  <div key={marking.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{marking.stage === 'INITIAL' ? 'Loteado inicial' : 'Loteado final'}</p>
                        <p className="text-[11px] text-gray-400">{marking.printed_batch_code || '-'}</p>
                      </div>
                      {marking.result && <Badge label={marking.result} color={marking.result === 'YES' ? 'green' : marking.result === 'NO' ? 'red' : 'gray'} />}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-50">
                      <SignatureBlock resourcePath="batch-lot-markings" resourceId={marking.id} role="RESPONSIBLE" label="Realizado por" />
                      <SignatureBlock resourcePath="batch-lot-markings" resourceId={marking.id} role="VERIFIER" label="Verificado por" />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100">
              <SignatureBlock resourcePath="packaging-controls" resourceId={control.id} role="RESPONSIBLE" label="Responsable" />
              <SignatureBlock resourcePath="packaging-controls" resourceId={control.id} role="VERIFIER" label="Verificador" />
            </div>
          </>
        )}
      </Card>

      <NewPackagingControlModal
        open={showPackagingModal}
        batchId={batch.id}
        onClose={() => setShowPackagingModal(false)}
        onCreated={async () => {
          setShowPackagingModal(false);
          await load();
        }}
      />
      {control && (
        <NewBatchLotMarkingModal
          open={showLotMarkingModal}
          packagingControlId={control.id}
          onClose={() => setShowLotMarkingModal(false)}
          onCreated={async () => {
            setShowLotMarkingModal(false);
            await load();
          }}
        />
      )}
      {control && (
        <LabelSampleModal
          open={showLabelModal}
          control={control}
          employees={employees}
          onClose={() => setShowLabelModal(false)}
          onSaved={async () => {
            setShowLabelModal(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function LabelSampleModal({
  open,
  control,
  employees,
  onClose,
  onSaved,
}: {
  open: boolean;
  control: PackagingControlRecord;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [labelCode, setLabelCode] = useState(control.label_code);
  const [artworkVersion, setArtworkVersion] = useState(control.artwork_version);
  const [labelMaterialBatch, setLabelMaterialBatch] = useState(control.label_material_batch);
  const [labelResult, setLabelResult] = useState<ResultStatus | ''>(control.label_result);
  const [observations, setObservations] = useState(control.label_observations);
  const [performedBy, setPerformedBy] = useState(control.label_performed_by ?? '');
  const [verifiedBy, setVerifiedBy] = useState(control.label_verified_by ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabelCode(control.label_code);
    setArtworkVersion(control.artwork_version);
    setLabelMaterialBatch(control.label_material_batch);
    setLabelResult(control.label_result);
    setObservations(control.label_observations);
    setPerformedBy(control.label_performed_by ?? '');
    setVerifiedBy(control.label_verified_by ?? '');
    setFile(null);
  }, [open, control]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await updatePackagingControlLabel(control.id, {
        label_code: labelCode,
        artwork_version: artworkVersion,
        label_material_batch: labelMaterialBatch,
        label_result: labelResult || undefined,
        label_observations: observations,
        label_performed_by: performedBy || null,
        label_verified_by: verifiedBy || null,
        label_sample_file: file,
      });
      toast.success('Etiqueta testigo registrada');
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la etiqueta testigo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Etiqueta testigo" open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Código de etiqueta</span>
            <input value={labelCode} onChange={(e) => setLabelCode(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Versión del arte</span>
            <input value={artworkVersion} onChange={(e) => setArtworkVersion(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Lote del material</span>
            <input value={labelMaterialBatch} onChange={(e) => setLabelMaterialBatch(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Resultado</span>
            <select value={labelResult} onChange={(e) => setLabelResult(e.target.value as ResultStatus | '')} className={selectCls}>
              <option value="">Sin definir</option>
              <option value="YES">Cumple</option>
              <option value="NO">No cumple</option>
              <option value="NOT_APPLICABLE">No aplica</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Observaciones</span>
          <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Realizado por</span>
            <select value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} className={selectCls}>
              <option value="">Sin asignar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{`${employee.first_name} ${employee.last_name}`.trim()}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Verificado por</span>
            <select value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} className={selectCls}>
              <option value="">Sin asignar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{`${employee.first_name} ${employee.last_name}`.trim()}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Foto de la etiqueta</span>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputCls} />
          {control.label_sample_file && !file && (
            <p className="text-[11px] text-gray-400 mt-1">Ya hay una foto guardada; sube una nueva solo si quieres reemplazarla.</p>
          )}
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar etiqueta testigo'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NewBatchLotMarkingModal({
  open,
  packagingControlId,
  onClose,
  onCreated,
}: {
  open: boolean;
  packagingControlId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [stage, setStage] = useState<'INITIAL' | 'FINAL'>('INITIAL');
  const [printedBatchCode, setPrintedBatchCode] = useState('');
  const [isLegible, setIsLegible] = useState(true);
  const [isCorrectlyPlaced, setIsCorrectlyPlaced] = useState(true);
  const [result, setResult] = useState<ResultStatus>('YES');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createBatchLotMarking({
        packaging_control: packagingControlId,
        stage,
        printed_batch_code: printedBatchCode,
        is_legible: isLegible,
        is_correctly_placed: isCorrectlyPlaced,
        result,
      });
      toast.success(stage === 'INITIAL' ? 'Loteado inicial registrado' : 'Loteado final registrado');
      setPrintedBatchCode('');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el loteado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Registrar loteado" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Etapa</span>
          <select value={stage} onChange={(e) => setStage(e.target.value as 'INITIAL' | 'FINAL')} className={selectCls}>
            <option value="INITIAL">Loteado inicial</option>
            <option value="FINAL">Loteado final</option>
          </select>
          {stage === 'FINAL' && (
            <p className="text-[11px] text-amber-600 mt-1">Requiere que el loteado inicial exista y esté aprobado.</p>
          )}
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Número de lote impreso</span>
          <input value={printedBatchCode} onChange={(e) => setPrintedBatchCode(e.target.value)} className={inputCls} />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={isLegible} onChange={(e) => setIsLegible(e.target.checked)} />
            Legible
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={isCorrectlyPlaced} onChange={(e) => setIsCorrectlyPlaced(e.target.checked)} />
            Ubicación correcta
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Resultado</span>
          <select value={result} onChange={(e) => setResult(e.target.value as ResultStatus)} className={selectCls}>
            <option value="YES">Cumple</option>
            <option value="NO">No cumple</option>
            <option value="NOT_APPLICABLE">No aplica</option>
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

function NewPackagingControlModal({
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
  const [unitsPerDisplay, setUnitsPerDisplay] = useState('');
  const [displaysPerBox, setDisplaysPerBox] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createPackagingControl({
        batch: batchId,
        units_per_display: unitsPerDisplay ? Number(unitsPerDisplay) : null,
        displays_per_box: displaysPerBox ? Number(displaysPerBox) : null,
      });
      toast.success('Control de acondicionamiento creado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el control');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo control de acondicionamiento" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Unidades por display</span>
          <input type="number" value={unitsPerDisplay} onChange={(e) => setUnitsPerDisplay(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Displays por caja</span>
          <input type="number" value={displaysPerBox} onChange={(e) => setDisplaysPerBox(e.target.value)} className={inputCls} />
        </label>
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
