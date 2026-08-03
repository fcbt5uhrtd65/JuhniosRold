import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, SecondaryButton } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  approveLineClearance,
  completeManufacturingStep,
  exportCleaningRecord,
  exportLineClearance,
  exportManufacturingSteps,
  getCleaningRecords,
  getLineClearances,
  getManufacturingStepExecutions,
  rejectLineClearance,
  type BatchRecord,
  type CleaningRecordRecord,
  type LineClearanceRecord,
  type ManufacturingStepExecutionRecord,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { PHASE_LABELS, formatDateTime } from './manufacturing-shared';
import { NewLineClearanceModal, NewCleaningRecordModal } from './manufacturing-clearance';

/* ═══════════════════════════════════════════════════════
   Pestaña "Fabricación" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function ManufacturingTab({ batch, employeeById }: { batch: BatchRecord; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [clearances, setClearances] = useState<LineClearanceRecord[]>([]);
  const [cleanings, setCleanings] = useState<CleaningRecordRecord[]>([]);
  const [steps, setSteps] = useState<ManufacturingStepExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [showCleaningModal, setShowCleaningModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clearancesRes, cleaningsRes, stepsRes] = await Promise.allSettled([
        getLineClearances(batch.id),
        getCleaningRecords(batch.id),
        getManufacturingStepExecutions(batch.id),
      ]);
      if (clearancesRes.status === 'fulfilled') setClearances(clearancesRes.value.filter((c) => c.phase === 'MANUFACTURING'));
      if (cleaningsRes.status === 'fulfilled') setCleanings(cleaningsRes.value.filter((c) => c.phase === 'MANUFACTURING'));
      if (stepsRes.status === 'fulfilled') setSteps(stepsRes.value);
    } catch {
      toast.error('No se pudo cargar la información de fabricación');
    } finally {
      setLoading(false);
    }
  }, [batch.id, toast]);

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

  const handleExportSteps = async () => {
    try {
      await exportManufacturingSteps(batch.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar las instrucciones de fabricación');
    }
  };

  const handleStepTransition = async (execution: ManufacturingStepExecutionRecord, nextStatus: 'IN_PROGRESS' | 'COMPLETED' | 'DEVIATED') => {
    try {
      await completeManufacturingStep(execution.id, { status: nextStatus });
      toast.success(nextStatus === 'COMPLETED' ? 'Paso completado' : nextStatus === 'IN_PROGRESS' ? 'Paso iniciado' : 'Paso marcado con desviación');
      setSteps(await getManufacturingStepExecutions(batch.id));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el paso');
    }
  };

  if (loading) return <LoadingState label="Cargando fabricación..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Despejes de línea</p>
          <SecondaryButton onClick={() => setShowClearanceModal(true)} icon={<Plus size={13} />}>Nuevo despeje</SecondaryButton>
        </div>
        {clearances.length === 0 ? (
          <EmptyState title="Sin despejes registrados" />
        ) : (
          <div className="space-y-2">
            {clearances.map((clearance) => (
              <div key={clearance.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{clearance.phase}</p>
                  <p className="text-[11px] text-gray-400">Área: {clearance.area_name || '-'} · {formatDateTime(clearance.cleared_at)}</p>
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
          <p className="text-sm font-semibold text-gray-900">Limpieza de áreas y equipos</p>
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
                    <p className="text-[11px] text-gray-400">{PHASE_LABELS[record.phase] || 'Fase sin definir'} · Sanitizante: {record.sanitizer || '-'} · {formatDateTime(record.cleaned_at)}</p>
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

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Instrucciones de fabricación</p>
          {steps.length > 0 && (
            <SecondaryButton onClick={() => void handleExportSteps()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
          )}
        </div>
        {steps.length === 0 ? (
          <EmptyState title="Sin pasos de fabricación ejecutados" description="Los pasos provienen de la fórmula maestra del producto." />
        ) : (
          <div className="space-y-2">
            {steps.map((execution) => (
              <div key={execution.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-900">Paso {execution.step_detail.sequence}. {execution.step_detail.phase || '-'}</p>
                  <div className="flex items-center gap-2">
                    <Badge label={execution.status} color={execution.status === 'COMPLETED' ? 'green' : execution.status === 'DEVIATED' ? 'red' : 'yellow'} />
                    {execution.status === 'PENDING' && (
                      <button onClick={() => void handleStepTransition(execution, 'IN_PROGRESS')} className="text-xs text-blue-600 hover:underline">Iniciar</button>
                    )}
                    {(execution.status === 'PENDING' || execution.status === 'IN_PROGRESS') && (
                      <>
                        <button onClick={() => void handleStepTransition(execution, 'COMPLETED')} className="text-xs text-emerald-600 hover:underline">Completar</button>
                        <button onClick={() => void handleStepTransition(execution, 'DEVIATED')} className="text-xs text-red-500 hover:underline">Desviación</button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">{execution.step_detail.instruction}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <SignatureBlock resourcePath="manufacturing-step-executions" resourceId={execution.id} role="RESPONSIBLE" label="Realizado por" />
                  <SignatureBlock resourcePath="manufacturing-step-executions" resourceId={execution.id} role="VERIFIER" label="Verificado por" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <NewLineClearanceModal
        open={showClearanceModal}
        batchId={batch.id}
        onClose={() => setShowClearanceModal(false)}
        onCreated={async () => {
          setShowClearanceModal(false);
          await load();
        }}
      />
      <NewCleaningRecordModal
        open={showCleaningModal}
        batchId={batch.id}
        onClose={() => setShowCleaningModal(false)}
        onCreated={async () => {
          setShowCleaningModal(false);
          await load();
        }}
      />
    </div>
  );
}

