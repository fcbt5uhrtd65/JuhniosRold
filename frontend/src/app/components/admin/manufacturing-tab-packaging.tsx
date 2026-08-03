import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import { SignaturePad } from './SignaturePad';
import { SignatureBlock } from './SignatureBlock';
import {
  createBatchLotMarking,
  createPackagingControl,
  createSealIntegrityControl,
  createWeightVolumeControl,
  exportPackagingControl,
  exportProductionControl,
  getPackagingControl,
  getProductionControl,
  signProductionControl,
  updatePackagingControlLabel,
  type BatchRecord,
  type PackagingControlRecord,
  type ProductionControlRecord,
  type ProductionControlSigner,
  type ResultStatus,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { getEmployeeName, getMediaUrl, SectionField } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Acondicionamiento" del expediente de lote.
═══════════════════════════════════════════════════════ */

function ProductionControlSection({
  batch,
  employeeById,
  employees,
}: {
  batch: BatchRecord;
  employeeById: Map<string, Employee>;
  employees: Employee[];
}) {
  const toast = useToast();
  const [control, setControl] = useState<ProductionControlRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setControl(await getProductionControl(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    if (!control) return;
    try {
      await exportProductionControl(control.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el control de producción');
    }
  };

  if (loading) return null;
  if (!control) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Control de producción (materiales de acondicionamiento)</p>
        {control.materials.length > 0 && (
          <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
        )}
      </div>
      {control.materials.length === 0 ? (
        <EmptyState title="Sin materiales registrados" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3">Material</th>
                <th className="py-2 pr-3">Entregado</th>
                <th className="py-2 pr-3">Consumido</th>
                <th className="py-2 pr-3">Buenas</th>
                <th className="py-2 pr-3">Malas proceso</th>
                <th className="py-2 pr-3">Malas fábrica</th>
                <th className="py-2 pr-3">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {control.materials.map((material) => (
                <tr key={material.id} className="border-b border-gray-50">
                  <td className="py-2 pr-3">{material.item}</td>
                  <td className="py-2 pr-3">{material.delivered_quantity}</td>
                  <td className="py-2 pr-3">{material.consumed_quantity}</td>
                  <td className="py-2 pr-3">{material.good_units}</td>
                  <td className="py-2 pr-3">{material.process_rejects}</td>
                  <td className="py-2 pr-3">{material.factory_rejects}</td>
                  <td className={`py-2 pr-3 ${Number(material.reconciliation_difference) !== 0 ? 'text-amber-600 font-semibold' : ''}`}>
                    {material.reconciliation_difference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-gray-100">
        <ProductionControlSignerBlock
          control={control}
          signer="warehouse"
          label="Bodega"
          signature={control.warehouse_signature}
          signedBy={control.warehouse_signed_by}
          employeeById={employeeById}
          employees={employees}
          onSigned={load}
        />
        <ProductionControlSignerBlock
          control={control}
          signer="responsible"
          label="Responsable"
          signature={control.responsible_signature}
          signedBy={control.responsible_signed_by}
          employeeById={employeeById}
          employees={employees}
          onSigned={load}
        />
        <ProductionControlSignerBlock
          control={control}
          signer="quality"
          label="Calidad"
          signature={control.quality_signature}
          signedBy={control.quality_signed_by}
          employeeById={employeeById}
          employees={employees}
          onSigned={load}
        />
        <ProductionControlSignerBlock
          control={control}
          signer="leader"
          label="Líder de área"
          signature={control.leader_signature}
          signedBy={control.leader_signed_by}
          employeeById={employeeById}
          employees={employees}
          onSigned={load}
        />
      </div>
    </Card>
  );
}

function ProductionControlSignerBlock({
  control,
  signer,
  label,
  signature,
  signedBy,
  employeeById,
  employees,
  onSigned,
}: {
  control: ProductionControlRecord;
  signer: ProductionControlSigner;
  label: string;
  signature: string | null;
  signedBy: string | null;
  employeeById: Map<string, Employee>;
  employees: Employee[];
  onSigned: () => Promise<void>;
}) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [employeeId, setEmployeeId] = useState(signedBy ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      toast.warning('Dibuja o carga una firma primero.');
      return;
    }
    setSaving(true);
    try {
      await signProductionControl(control.id, signer, { signature: file, signed_by: employeeId || null });
      toast.success('Firma registrada');
      setShowModal(false);
      setFile(null);
      await onSigned();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la firma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <button onClick={() => setShowModal(true)} className="text-xs text-[#2a4038] font-semibold hover:underline">
          {signature ? 'Reemplazar' : 'Firmar'}
        </button>
      </div>
      {signature ? (
        <div className="flex items-center gap-2">
          <img src={getMediaUrl(signature)} alt={`Firma ${label}`} className="h-10 border border-gray-200 rounded bg-white" />
          <span className="text-[11px] text-gray-400">{getEmployeeName(employeeById.get(signedBy ?? ''))}</span>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">Sin firma registrada.</p>
      )}

      <Modal title={`Firma — ${label}`} open={showModal} onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Empleado</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={selectCls}>
              <option value="">Sin asignar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{getEmployeeName(employee)}</option>
              ))}
            </select>
          </label>
          <SignaturePad label={`Firma de ${label}`} onChange={setFile} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowModal(false)}>Cancelar</SecondaryButton>
            <PrimaryButton onClick={() => void handleSubmit()} disabled={saving || !file}>
              {saving ? 'Guardando...' : 'Confirmar firma'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function PackagingTab({
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

      <ProductionControlSection batch={batch} employeeById={employeeById} employees={employees} />

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
        <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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

