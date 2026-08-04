import { useCallback, useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, SecondaryButton } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  completeManufacturingStep,
  exportManufacturingSteps,
  getManufacturingStepExecutions,
  type BatchRecord,
  type ManufacturingStepExecutionRecord,
} from '../../services/manufacturing.service';

/* ═══════════════════════════════════════════════════════
   Pestaña "Fabricación" del expediente de lote (instrucciones
   maestras ejecutadas). El despeje de línea y la limpieza de
   esta fase se registran en las pestañas dedicadas "Despeje
   dispensación" y "Limpieza dispensación" (cubren DISPENSING +
   MANUFACTURING), para no duplicar el registro en dos lugares.
═══════════════════════════════════════════════════════ */

export function ManufacturingTab({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [steps, setSteps] = useState<ManufacturingStepExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSteps(await getManufacturingStepExecutions(batch.id));
    } catch {
      toast.error('No se pudo cargar la información de fabricación');
    } finally {
      setLoading(false);
    }
  }, [batch.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
  );
}
