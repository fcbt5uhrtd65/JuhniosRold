import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileDown, FileText, Gauge, Loader2, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, KpiCard, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import { SignaturePad } from './SignaturePad';
import { SignatureBlock } from './SignatureBlock';
import {
  exportBatchRelease,
  exportDocumentChecklist,
  exportMicrobiologyAnalysis,
  getAnalysisCertificate,
  getBatchRelease,
  getDocumentChecklist,
  getDocumentChecklistSummary,
  getLineClearances,
  getMicrobiologyAnalysis,
  getSealIntegrityControl,
  getWeightVolumeControl,
  releaseBatch,
  type AnalysisCertificateRecord,
  type BatchRecord,
  type BatchReleaseRecord,
  type BatchStatus,
  type DocumentChecklistItemRecord,
  type DocumentChecklistSummary,
  type LineClearanceRecord,
  type MicrobiologyAnalysisRecord,
  type SealIntegrityControlRecord,
  type WeightVolumeControlRecord,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { STATUS_LABELS, SectionField, formatDate, formatDateTime, getEmployeeName } from './manufacturing-shared';
import { NewMicrobiologyAnalysisModal } from './manufacturing-tab-quality';

/* ═══════════════════════════════════════════════════════
   Pestañas "Calidad final", "Documentos", "Liberación" e
   "Historial" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function FinalQualityTab({ batch }: { batch: BatchRecord }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-gray-900 mb-2">Calidad final</p>
      <p className="text-xs text-gray-500">
        Los resultados de calidad final (certificado de producto terminado, microbiología y controles físicos) se consolidan
        en las pestañas de "Calidad del granel" y "Acondicionamiento" — comparten los mismos registros del expediente del lote {batch.batch_code || batch.production_order_number}.
      </p>
    </Card>
  );
}

export function DocumentsTab({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [items, setItems] = useState<DocumentChecklistItemRecord[]>([]);
  const [summary, setSummary] = useState<DocumentChecklistSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes] = await Promise.all([getDocumentChecklist(batch.id), getDocumentChecklistSummary(batch.id)]);
      setItems(itemsRes);
      setSummary(summaryRes);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la verificación documental');
    } finally {
      setLoading(false);
    }
  }, [batch.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    try {
      await exportDocumentChecklist(batch.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar la verificación documental');
    }
  };

  if (loading) return <LoadingState label="Cargando verificación documental..." />;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="Total" value={String(summary.total)} icon={FileText} color="text-gray-600 bg-gray-100" />
          <KpiCard label="Completados" value={String(summary.completed)} icon={CheckCircle2} color="text-emerald-600 bg-emerald-50" />
          <KpiCard label="Pendientes" value={String(summary.pending)} icon={Loader2} color="text-amber-600 bg-amber-50" />
          <KpiCard label="Rechazados" value={String(summary.rejected)} icon={AlertTriangle} color="text-red-600 bg-red-50" />
          <KpiCard label="% Expediente" value={`${summary.completion_percentage}%`} icon={Gauge} color="text-blue-600 bg-blue-50" />
        </div>
      )}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Documentos del expediente</p>
          <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar verificación</SecondaryButton>
        </div>
        {items.length === 0 ? (
          <EmptyState title="Sin documentos configurados para este lote" />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{item.name}</p>
                  <p className="text-[11px] text-gray-400">{item.applies ? 'Aplica' : 'No aplica'}</p>
                </div>
                <Badge
                  label={item.status}
                  color={item.status === 'APPROVED' ? 'green' : item.status === 'REJECTED' ? 'red' : item.status === 'PENDING' ? 'yellow' : 'blue'}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}


type ReleaseChecklistStatus = 'ok' | 'warning' | 'blocked' | 'loading';

function ReleaseChecklistItem({ label, status, detail }: { label: string; status: ReleaseChecklistStatus; detail: string }) {
  const iconColor = status === 'ok' ? 'text-emerald-600 bg-emerald-50' : status === 'warning' ? 'text-amber-600 bg-amber-50' : status === 'blocked' ? 'text-red-600 bg-red-50' : 'text-gray-400 bg-gray-50';
  const Icon = status === 'ok' ? CheckCircle2 : status === 'blocked' ? AlertTriangle : Gauge;
  return (
    <div className="flex items-start gap-3 border border-gray-100 rounded-lg p-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-900">{label}</p>
        <p className="text-[11px] text-gray-400 break-words">{detail}</p>
      </div>
    </div>
  );
}

function ReleaseChecklist({ batch }: { batch: BatchRecord }) {
  const [certificate, setCertificate] = useState<AnalysisCertificateRecord | null>(null);
  const [microbiology, setMicrobiology] = useState<MicrobiologyAnalysisRecord | null>(null);
  const [weight, setWeight] = useState<WeightVolumeControlRecord | null>(null);
  const [seal, setSeal] = useState<SealIntegrityControlRecord | null>(null);
  const [clearances, setClearances] = useState<LineClearanceRecord[]>([]);
  const [docsSummary, setDocsSummary] = useState<DocumentChecklistSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [certRes, microRes, weightRes, sealRes, clearancesRes, docsRes] = await Promise.allSettled([
        getAnalysisCertificate(batch.id),
        getMicrobiologyAnalysis(batch.id),
        getWeightVolumeControl(batch.id),
        getSealIntegrityControl(batch.id),
        getLineClearances(batch.id),
        getDocumentChecklistSummary(batch.id),
      ]);
      if (certRes.status === 'fulfilled') setCertificate(certRes.value);
      if (microRes.status === 'fulfilled') setMicrobiology(microRes.value);
      if (weightRes.status === 'fulfilled') setWeight(weightRes.value);
      if (sealRes.status === 'fulfilled') setSeal(sealRes.value);
      if (clearancesRes.status === 'fulfilled') setClearances(clearancesRes.value);
      if (docsRes.status === 'fulfilled') setDocsSummary(docsRes.value);
      setLoading(false);
    })();
  }, [batch.id]);

  if (loading) return <LoadingState label="Verificando expediente..." />;

  const pendingClearances = clearances.filter((c) => c.status === 'PENDING').length;
  const rejectedClearances = clearances.filter((c) => c.status === 'REJECTED').length;

  const items: Array<{ label: string; status: ReleaseChecklistStatus; detail: string }> = [
    {
      label: 'Certificado de análisis',
      status: !certificate ? 'blocked' : certificate.concept === 'APPROVED' ? 'ok' : certificate.concept === 'REJECTED' ? 'blocked' : 'warning',
      detail: !certificate ? 'Sin certificado registrado' : certificate.concept === 'APPROVED' ? 'Aprobado' : certificate.concept === 'REJECTED' ? 'Rechazado' : certificate.concept,
    },
    {
      label: 'Análisis microbiológico',
      status: !microbiology ? 'warning' : microbiology.overall_result === 'APPROVED' ? 'ok' : microbiology.overall_result === 'REJECTED' ? 'blocked' : 'warning',
      detail: !microbiology ? 'Sin análisis registrado' : microbiology.overall_result,
    },
    {
      label: 'Control de peso o volumen',
      status: !weight ? 'warning' : weight.overall_result === 'APPROVED' ? 'ok' : weight.overall_result === 'REJECTED' ? 'blocked' : 'warning',
      detail: !weight ? 'Sin registro' : weight.overall_result,
    },
    {
      label: 'Control de hermeticidad',
      status: !seal ? 'warning' : seal.overall_result === 'APPROVED' || seal.overall_result === 'NOT_APPLICABLE' ? 'ok' : seal.overall_result === 'REJECTED' ? 'blocked' : 'warning',
      detail: !seal ? 'Sin registro' : seal.overall_result === 'NOT_APPLICABLE' ? 'No aplica' : seal.overall_result,
    },
    {
      label: 'Despejes de línea',
      status: rejectedClearances > 0 ? 'blocked' : pendingClearances > 0 ? 'warning' : clearances.length === 0 ? 'warning' : 'ok',
      detail: clearances.length === 0 ? 'Sin despejes registrados' : `${clearances.length - pendingClearances - rejectedClearances} aprobado(s), ${pendingClearances} pendiente(s), ${rejectedClearances} rechazado(s)`,
    },
    {
      label: 'Documentos del expediente',
      status: !docsSummary ? 'warning' : docsSummary.rejected > 0 ? 'blocked' : docsSummary.completion_percentage >= 100 ? 'ok' : 'warning',
      detail: !docsSummary ? 'Sin información' : `${docsSummary.completion_percentage}% completado (${docsSummary.pending} pendiente(s))`,
    },
  ];

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-gray-900 mb-1">Checklist previo a liberación</p>
      <p className="text-[11px] text-gray-400 mb-3">Se verifica automáticamente antes de permitir la liberación del lote.</p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {items.map((item) => (
          <ReleaseChecklistItem key={item.label} {...item} />
        ))}
      </div>
    </Card>
  );
}

function ReleaseMicrobiologySection({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [microbiology, setMicrobiology] = useState<MicrobiologyAnalysisRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMicrobiology(await getMicrobiologyAnalysis(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    if (!microbiology) return;
    try {
      await exportMicrobiologyAnalysis(microbiology.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el análisis microbiológico');
    }
  };

  if (loading) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Análisis microbiológico</p>
        {microbiology ? (
          <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
        ) : (
          <SecondaryButton onClick={() => setShowModal(true)} icon={<Plus size={13} />}>Nuevo análisis</SecondaryButton>
        )}
      </div>
      {!microbiology ? (
        <EmptyState title="Sin análisis microbiológico registrado" />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4 mb-3">
            <SectionField label="Laboratorio" value={microbiology.laboratory || '-'} />
            <SectionField label="N.º informe" value={microbiology.report_number || '-'} />
            <SectionField label="Resultado general" value={microbiology.overall_result} />
            <SectionField label="Fecha de aprobación" value={formatDate(microbiology.approved_at)} />
          </div>
          <SignatureBlock resourcePath="microbiology-analyses" resourceId={microbiology.id} role="RESPONSIBLE" label="Aprobado por" />
        </>
      )}

      <NewMicrobiologyAnalysisModal
        open={showModal}
        batchId={batch.id}
        onClose={() => setShowModal(false)}
        onCreated={async () => {
          setShowModal(false);
          await load();
        }}
      />
    </Card>
  );
}

export function ReleaseTab({
  batch,
  employeeById,
  onRefresh,
}: {
  batch: BatchRecord;
  employeeById: Map<string, Employee>;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [release, setRelease] = useState<BatchReleaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releasedQuantity, setReleasedQuantity] = useState('');
  const [retainedQuantity, setRetainedQuantity] = useState('0');
  const [rejectedQuantity, setRejectedQuantity] = useState('0');
  const [condition, setCondition] = useState<'RELEASED' | 'CONDITIONAL' | 'REJECTED'>('RELEASED');
  const [observations, setObservations] = useState('');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRelease(await getBatchRelease(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRelease = async () => {
    setSaving(true);
    try {
      await releaseBatch({
        batch: batch.id,
        released_quantity: Number(releasedQuantity || 0),
        retained_quantity: Number(retainedQuantity || 0),
        rejected_quantity: Number(rejectedQuantity || 0),
        condition,
        observations,
        quality_signature: signatureFile,
      });
      toast.success('Lote liberado');
      setShowReleaseModal(false);
      setSignatureFile(null);
      await load();
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo liberar el lote. Verifica que el expediente esté completo.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!release) return;
    try {
      await exportBatchRelease(release.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar la liberación');
    }
  };

  if (loading) return <LoadingState label="Cargando liberación..." />;

  return (
    <div className="space-y-4">
      <ReleaseChecklist batch={batch} />
      <ReleaseMicrobiologySection batch={batch} />

      {!release ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Liberación de producto terminado</p>
          <p className="text-xs text-gray-500 mb-4">
            Revisa el checklist antes de liberar — el sistema también valida automáticamente al confirmar.
          </p>
          <PrimaryButton onClick={() => setShowReleaseModal(true)}>Liberar lote</PrimaryButton>

          <Modal title="Liberar lote" open={showReleaseModal} onClose={() => setShowReleaseModal(false)} wide>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Cantidad liberada</span>
                  <input type="number" value={releasedQuantity} onChange={(e) => setReleasedQuantity(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Cantidad retenida</span>
                  <input type="number" value={retainedQuantity} onChange={(e) => setRetainedQuantity(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Cantidad rechazada</span>
                  <input type="number" value={rejectedQuantity} onChange={(e) => setRejectedQuantity(e.target.value)} className={inputCls} />
                </label>
              </div>
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Condición</span>
                <select value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)} className={selectCls}>
                  <option value="RELEASED">Liberado</option>
                  <option value="CONDITIONAL">Liberado condicional</option>
                  <option value="REJECTED">Rechazado</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Observaciones</span>
                <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </label>
              <SignaturePad label="Firma de Calidad" onChange={setSignatureFile} />
              <div className="flex justify-end gap-2 pt-2">
                <SecondaryButton onClick={() => setShowReleaseModal(false)}>Cancelar</SecondaryButton>
                <PrimaryButton onClick={() => void handleRelease()} disabled={saving}>
                  {saving ? 'Liberando...' : 'Confirmar liberación'}
                </PrimaryButton>
              </div>
            </div>
          </Modal>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-900">Liberación de producto terminado</p>
            <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SectionField label="Cantidad liberada" value={release.released_quantity} />
            <SectionField label="Cantidad retenida" value={release.retained_quantity} />
            <SectionField label="Cantidad rechazada" value={release.rejected_quantity} />
            <SectionField label="Condición" value={release.condition} />
            <SectionField label="Liberado por Calidad" value={getEmployeeName(employeeById.get(release.released_by_quality ?? ''))} />
            <SectionField label="Aprobado por Director Técnico" value={getEmployeeName(employeeById.get(release.approved_by_technical_director ?? ''))} />
            <SectionField label="Fecha de liberación" value={formatDateTime(release.released_at)} />
          </div>
        </Card>
      )}
    </div>
  );
}

export function HistoryTab({ batch }: { batch: BatchRecord }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-gray-900 mb-3">Historial de estados</p>
      {batch.status_history.length === 0 ? (
        <EmptyState title="Sin cambios de estado registrados" />
      ) : (
        <div className="space-y-2">
          {batch.status_history.map((entry) => (
            <div key={entry.id} className="text-xs border-b border-gray-100 pb-2">
              <div className="font-medium text-gray-900">
                {STATUS_LABELS[entry.previous_status as BatchStatus] || entry.previous_status || 'Inicio'} → {STATUS_LABELS[entry.new_status as BatchStatus] || entry.new_status}
              </div>
              <div className="text-gray-400">{entry.reason || 'Sin motivo'} · {formatDateTime(entry.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
