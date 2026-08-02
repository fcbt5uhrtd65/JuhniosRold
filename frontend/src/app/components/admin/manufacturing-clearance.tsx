import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  approveLineClearance,
  createCleaningRecord,
  createLineClearance,
  exportCleaningRecord,
  exportLineClearance,
  getCleaningRecords,
  getLineClearances,
  rejectLineClearance,
  type BatchRecord,
  type CleaningRecordRecord,
  type LineClearanceRecord,
} from '../../services/manufacturing.service';
import { formatDateTime, useAreasAndLines } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Despeje de línea y registros de limpieza — compartido
   entre las pestañas de Dispensación, Fabricación y Llenado.
═══════════════════════════════════════════════════════ */

export function NewLineClearanceModal({
  open,
  batchId,
  defaultPhase,
  onClose,
  onCreated,
}: {
  open: boolean;
  batchId: string;
  defaultPhase?: 'DISPENSING' | 'MANUFACTURING' | 'FILLING' | 'PACKAGING';
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const { areas, productionLines } = useAreasAndLines();
  const [phase, setPhase] = useState<'DISPENSING' | 'MANUFACTURING' | 'FILLING' | 'PACKAGING'>(defaultPhase ?? 'MANUFACTURING');
  const [area, setArea] = useState('');
  const [productionLine, setProductionLine] = useState('');
  const [previousProduct, setPreviousProduct] = useState('');
  const [previousBatchCode, setPreviousBatchCode] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createLineClearance({
        batch: batchId,
        phase,
        area: area || null,
        production_line: productionLine || null,
        previous_product: previousProduct,
        previous_batch_code: previousBatchCode,
      });
      toast.success('Despeje registrado');
      setArea('');
      setProductionLine('');
      setPreviousProduct('');
      setPreviousBatchCode('');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el despeje');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo despeje de línea" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Fase</span>
          <select value={phase} onChange={(e) => setPhase(e.target.value as typeof phase)} className={selectCls}>
            <option value="DISPENSING">Dispensación</option>
            <option value="MANUFACTURING">Fabricación</option>
            <option value="FILLING">Llenado</option>
            <option value="PACKAGING">Acondicionamiento</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Producto anterior</span>
            <input value={previousProduct} onChange={(e) => setPreviousProduct(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Lote anterior</span>
            <input value={previousBatchCode} onChange={(e) => setPreviousBatchCode(e.target.value)} className={inputCls} />
          </label>
        </div>
        <p className="text-[11px] text-gray-400">
          El checklist de criterios (limpieza, ausencia de materiales de otro producto, etc.) se diligencia después de crear el despeje.
        </p>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear despeje'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function NewCleaningRecordModal({
  open,
  batchId,
  defaultPhase,
  onClose,
  onCreated,
}: {
  open: boolean;
  batchId: string;
  defaultPhase?: 'DISPENSING' | 'MANUFACTURING' | 'FILLING' | 'PACKAGING';
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [recordType, setRecordType] = useState<'AREA' | 'EQUIPMENT'>('AREA');
  const [phase, setPhase] = useState<'DISPENSING' | 'MANUFACTURING' | 'FILLING' | 'PACKAGING'>(defaultPhase ?? 'MANUFACTURING');
  const [area, setArea] = useState('');
  const [equipment, setEquipment] = useState('');
  const [equipmentCode, setEquipmentCode] = useState('');
  const [sanitizer, setSanitizer] = useState('');
  const [sanitizerConcentration, setSanitizerConcentration] = useState('');
  const [sanitizerBatch, setSanitizerBatch] = useState('');
  const [sanitizerExpiresAt, setSanitizerExpiresAt] = useState('');
  const [cleaningMethod, setCleaningMethod] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createCleaningRecord({
        batch: batchId,
        record_type: recordType,
        phase,
        area: recordType === 'AREA' ? area : '',
        equipment: recordType === 'EQUIPMENT' ? equipment : '',
        equipment_code: equipmentCode,
        cleaned_at: new Date().toISOString(),
        cleaning_method: cleaningMethod,
        sanitizer,
        sanitizer_concentration: sanitizerConcentration,
        sanitizer_batch: sanitizerBatch,
        sanitizer_expires_at: sanitizerExpiresAt || null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      });
      toast.success('Limpieza registrada');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la limpieza');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nueva limpieza de área o equipo" open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tipo</span>
          <select value={recordType} onChange={(e) => setRecordType(e.target.value as typeof recordType)} className={selectCls}>
            <option value="AREA">Área limpia</option>
            <option value="EQUIPMENT">Equipo limpio</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Fase del proceso</span>
          <select value={phase} onChange={(e) => setPhase(e.target.value as typeof phase)} className={selectCls}>
            <option value="DISPENSING">Dispensación</option>
            <option value="MANUFACTURING">Fabricación</option>
            <option value="FILLING">Llenado</option>
            <option value="PACKAGING">Acondicionamiento</option>
          </select>
        </label>
        {recordType === 'AREA' ? (
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Área</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Equipo</span>
              <input value={equipment} onChange={(e) => setEquipment(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Código del equipo</span>
              <input value={equipmentCode} onChange={(e) => setEquipmentCode(e.target.value)} className={inputCls} />
            </label>
          </div>
        )}
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Método de limpieza</span>
          <textarea value={cleaningMethod} onChange={(e) => setCleaningMethod(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Sanitizante</span>
            <input value={sanitizer} onChange={(e) => setSanitizer(e.target.value)} className={inputCls} placeholder="Ej: Alcohol etílico 70%" />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Concentración</span>
            <input value={sanitizerConcentration} onChange={(e) => setSanitizerConcentration(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Lote sanitizante</span>
            <input value={sanitizerBatch} onChange={(e) => setSanitizerBatch(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Vencimiento del sanitizante</span>
            <input type="date" value={sanitizerExpiresAt} onChange={(e) => setSanitizerExpiresAt(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Vigencia de esta limpieza hasta</span>
            <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar limpieza'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function PhaseClearanceAndCleaningSection({
  batch,
  phase,
  phaseLabel,
}: {
  batch: BatchRecord;
  phase: 'DISPENSING' | 'MANUFACTURING' | 'FILLING' | 'PACKAGING';
  phaseLabel: string;
}) {
  const toast = useToast();
  const [clearances, setClearances] = useState<LineClearanceRecord[]>([]);
  const [cleanings, setCleanings] = useState<CleaningRecordRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [showCleaningModal, setShowCleaningModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clearancesRes, cleaningsRes] = await Promise.allSettled([
        getLineClearances(batch.id),
        getCleaningRecords(batch.id),
      ]);
      if (clearancesRes.status === 'fulfilled') {
        setClearances(clearancesRes.value.filter((c) => c.phase === phase));
      }
      if (cleaningsRes.status === 'fulfilled') {
        setCleanings(cleaningsRes.value.filter((c) => c.phase === phase));
      }
    } catch (error) {
      console.error(error);
      toast.error(`No se pudo cargar despeje/limpieza de ${phaseLabel.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [batch.id, phase, phaseLabel, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (id: string) => {
    try {
      await approveLineClearance(id);
      toast.success('Despeje aprobado');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo aprobar el despeje');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectLineClearance(id);
      toast.info('Despeje rechazado');
      await load();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo rechazar el despeje');
    }
  };

  const handleExportClearance = async (clearance: LineClearanceRecord) => {
    try {
      await exportLineClearance(clearance.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el despeje');
    }
  };

  const handleExportCleaning = async (record: CleaningRecordRecord) => {
    try {
      await exportCleaningRecord(record.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar la limpieza');
    }
  };

  if (loading) return null;

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Despeje de línea ({phaseLabel.toLowerCase()})</p>
          <SecondaryButton onClick={() => setShowClearanceModal(true)} icon={<Plus size={13} />}>Nuevo despeje</SecondaryButton>
        </div>
        {clearances.length === 0 ? (
          <EmptyState title="Sin despejes registrados" />
        ) : (
          <div className="space-y-2">
            {clearances.map((clearance) => (
              <div key={clearance.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">Área: {clearance.area_name || '-'}</p>
                  <p className="text-[11px] text-gray-400">{formatDateTime(clearance.cleared_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={clearance.status} color={clearance.status === 'APPROVED' ? 'green' : clearance.status === 'REJECTED' ? 'red' : 'yellow'} />
                  {clearance.status === 'PENDING' && (
                    <>
                      <button onClick={() => void handleApprove(clearance.id)} className="text-xs text-emerald-600 hover:underline">Aprobar</button>
                      <button onClick={() => void handleReject(clearance.id)} className="text-xs text-red-500 hover:underline">Rechazar</button>
                    </>
                  )}
                  <button onClick={() => void handleExportClearance(clearance)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                    <FileDown size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Limpieza de áreas y equipos ({phaseLabel.toLowerCase()})</p>
          <SecondaryButton onClick={() => setShowCleaningModal(true)} icon={<Plus size={13} />}>Nueva limpieza</SecondaryButton>
        </div>
        {cleanings.length === 0 ? (
          <EmptyState title="Sin registros de limpieza" />
        ) : (
          <div className="space-y-2">
            {cleanings.map((record) => (
              <div key={record.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{record.record_type === 'AREA' ? record.area : record.equipment}</p>
                    <p className="text-[11px] text-gray-400">Sanitizante: {record.sanitizer || '-'} · {formatDateTime(record.cleaned_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.is_expired && <Badge label="Vencida" color="red" />}
                    {record.result && <Badge label={record.result} color={record.result === 'APPROVED' ? 'green' : 'red'} />}
                    <button onClick={() => void handleExportCleaning(record)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors" title="Exportar">
                      <FileDown size={12} />
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-50">
                  <SignatureBlock resourcePath="cleaning-records" resourceId={record.id} role="RESPONSIBLE" label="Realizado por" />
                  <SignatureBlock resourcePath="cleaning-records" resourceId={record.id} role="VERIFIER" label="Verificado por" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <NewLineClearanceModal
        open={showClearanceModal}
        batchId={batch.id}
        defaultPhase={phase}
        onClose={() => setShowClearanceModal(false)}
        onCreated={async () => {
          setShowClearanceModal(false);
          await load();
        }}
      />
      <NewCleaningRecordModal
        open={showCleaningModal}
        batchId={batch.id}
        defaultPhase={phase}
        onClose={() => setShowCleaningModal(false)}
        onCreated={async () => {
          setShowCleaningModal(false);
          await load();
        }}
      />
    </>
  );
}

