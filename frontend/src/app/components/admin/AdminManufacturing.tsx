import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Beaker,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  FileDown,
  FileText,
  FlaskConical,
  Gauge,
  History,
  Loader2,
  Package,
  PlayCircle,
  Plus,
  Scale,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  Badge,
  type BadgeColor,
  Card,
  EmptyState,
  KpiCard,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TabBar,
  inputCls,
  selectCls,
} from './AdminUI';
import { SignaturePad } from './SignaturePad';
import {
  approveLineClearance,
  changeBatchStatus,
  createBatch,
  exportAnalysisCertificate,
  exportBatchDossier,
  exportDispensingOrder,
  exportDocumentChecklist,
  exportLineClearance,
  exportBatchRelease,
  getAnalysisCertificate,
  getBatches,
  getCleaningRecords,
  getDispensingOrderByBatch,
  getDocumentChecklist,
  getDocumentChecklistSummary,
  getFillingControl,
  getLineClearances,
  getLineIdentification,
  getManufacturingStepExecutions,
  getMicrobiologyAnalysis,
  getPackagingControl,
  getProductionControl,
  getBatchRelease,
  getSealIntegrityControl,
  getWeightVolumeControl,
  rejectLineClearance,
  releaseBatch,
  startBatch,
  verifyDispensingLine,
  weighDispensingLine,
  type AnalysisCertificateRecord,
  type BatchRecord,
  type BatchStatus,
  type CleaningRecordRecord,
  type DispensingOrderRecord,
  type DocumentChecklistItemRecord,
  type DocumentChecklistSummary,
  type FillingControlRecord,
  type LineClearanceRecord,
  type LineIdentificationRecord,
  type ManufacturingStepExecutionRecord,
  type MicrobiologyAnalysisRecord,
  type PackagingControlRecord,
  type ProductionControlRecord,
  type BatchReleaseRecord,
  type SealIntegrityControlRecord,
  type WeightVolumeControlRecord,
} from '../../services/manufacturing.service';
import { getEmployees, type Employee } from '../../services/employees.service';

type BatchTab =
  | 'general'
  | 'dispensing'
  | 'manufacturing'
  | 'bulk_quality'
  | 'filling'
  | 'packaging'
  | 'final_quality'
  | 'documents'
  | 'release'
  | 'history';

const BATCH_TABS: Array<{ id: BatchTab; label: string; icon: typeof FileText }> = [
  { id: 'general', label: 'Información general', icon: FileText },
  { id: 'dispensing', label: 'Dispensación', icon: Scale },
  { id: 'manufacturing', label: 'Fabricación', icon: FlaskConical },
  { id: 'bulk_quality', label: 'Calidad del granel', icon: Beaker },
  { id: 'filling', label: 'Llenado', icon: Droplets },
  { id: 'packaging', label: 'Acondicionamiento', icon: Boxes },
  { id: 'final_quality', label: 'Calidad final', icon: ShieldCheck },
  { id: 'documents', label: 'Documentos', icon: ClipboardCheck },
  { id: 'release', label: 'Liberación', icon: Truck },
  { id: 'history', label: 'Historial', icon: History },
];

const STATUS_LABELS: Record<BatchStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  PENDING_DISPENSING: 'Pendiente de dispensación',
  DISPENSING: 'En dispensación',
  DISPENSING_DONE: 'Dispensación completada',
  MANUFACTURING: 'En fabricación',
  BULK_PENDING_ANALYSIS: 'Granel pendiente de análisis',
  BULK_APPROVED: 'Granel aprobado',
  FILLING: 'En llenado',
  PACKAGING: 'En acondicionamiento',
  FINISHED_QUARANTINE: 'PT en cuarentena',
  PENDING_DOCUMENTS: 'Pendiente de documentos',
  PENDING_MICROBIOLOGY: 'Pendiente de microbiología',
  RELEASED: 'Liberada',
  REJECTED: 'Rechazada',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
};

const STATUS_ORDER: BatchStatus[] = [
  'DRAFT', 'SCHEDULED', 'PENDING_DISPENSING', 'DISPENSING', 'DISPENSING_DONE', 'MANUFACTURING',
  'BULK_PENDING_ANALYSIS', 'BULK_APPROVED', 'FILLING', 'PACKAGING', 'FINISHED_QUARANTINE',
  'PENDING_DOCUMENTS', 'PENDING_MICROBIOLOGY', 'RELEASED',
];

function statusBadgeColor(status: BatchStatus): BadgeColor {
  if (status === 'RELEASED') return 'green';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'red';
  if (status === 'CLOSED') return 'blue';
  if (status.startsWith('PENDING') || status === 'FINISHED_QUARANTINE' || status === 'BULK_PENDING_ANALYSIS') return 'yellow';
  return 'purple';
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CO');
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-CO');
}

function getEmployeeName(employee: Employee | undefined): string {
  if (!employee) return 'Sin asignar';
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

export function AdminManufacturing() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchRecord | null>(null);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [batchesRes, employeesRes] = await Promise.allSettled([getBatches(), getEmployees({ limit: 500 })]);
      if (batchesRes.status === 'fulfilled') setBatches(batchesRes.value);
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el módulo de producción');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    return {
      total: batches.length,
      active: batches.filter((batch) => !batch.is_terminal).length,
      released: batches.filter((batch) => batch.status === 'RELEASED').length,
      rejected: batches.filter((batch) => batch.status === 'REJECTED').length,
    };
  }, [batches]);

  const handleExportDossier = async (batch: BatchRecord) => {
    try {
      await exportBatchDossier(batch.id, batch.batch_code || batch.production_order_number);
      toast.success('Expediente generado');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el expediente');
    }
  };

  if (isLoading) {
    return <LoadingState label="Cargando módulo de producción..." />;
  }

  if (selectedBatch) {
    return (
      <BatchDetail
        batch={selectedBatch}
        employeeById={employeeById}
        onBack={() => setSelectedBatch(null)}
        onRefresh={async () => {
          const updated = await getBatches();
          setBatches(updated);
          const refreshed = updated.find((item) => item.id === selectedBatch.id);
          if (refreshed) setSelectedBatch(refreshed);
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Producción y manufactura"
        subtitle="Expediente completo de fabricación de lotes: dispensación, calidad, llenado, acondicionamiento y liberación."
        onNew={() => setShowNewBatchModal(true)}
        newLabel="Nuevo lote"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Lotes totales" value={String(stats.total)} icon={Package} color="text-gray-600 bg-gray-100" />
        <KpiCard label="En proceso" value={String(stats.active)} icon={Loader2} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Liberados" value={String(stats.released)} icon={CheckCircle2} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Rechazados" value={String(stats.rejected)} icon={AlertTriangle} color="text-red-600 bg-red-50" />
      </div>

      {batches.length === 0 ? (
        <EmptyState
          title="No hay lotes registrados"
          description="Crea un lote a partir de una orden de producción existente para iniciar su expediente de fabricación."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <Card
              key={batch.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div onClick={() => setSelectedBatch(batch)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{batch.batch_code || batch.production_order_number}</p>
                    <p className="text-[11px] text-gray-400">{batch.production_order_number}</p>
                  </div>
                  <Badge label={STATUS_LABELS[batch.status]} color={statusBadgeColor(batch.status)} />
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Área: {batch.area || 'Sin asignar'}</p>
                  <p>Línea: {batch.production_line || 'Sin asignar'}</p>
                  <p>Responsable: {getEmployeeName(employeeById.get(batch.production_manager ?? ''))}</p>
                  <p>Programada: {formatDate(batch.scheduled_at)}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setSelectedBatch(batch)}
                  className="flex-1 text-xs font-semibold text-[#2a4038] hover:underline"
                >
                  Ver expediente
                </button>
                <button
                  onClick={() => void handleExportDossier(batch)}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  title="Exportar expediente completo"
                >
                  <FileDown size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewBatchModal
        open={showNewBatchModal}
        employees={employees}
        onClose={() => setShowNewBatchModal(false)}
        onCreated={async () => {
          setShowNewBatchModal(false);
          await loadData();
        }}
      />
    </div>
  );
}

function NewBatchModal({
  open,
  employees,
  onClose,
  onCreated,
}: {
  open: boolean;
  employees: Employee[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [productionOrderId, setProductionOrderId] = useState('');
  const [area, setArea] = useState('');
  const [productionLine, setProductionLine] = useState('');
  const [productionManager, setProductionManager] = useState('');
  const [qualityManager, setQualityManager] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!productionOrderId.trim()) {
      toast.error('Debes indicar el ID de la orden de producción');
      return;
    }
    setSaving(true);
    try {
      await createBatch({
        production_order: productionOrderId.trim(),
        area,
        production_line: productionLine,
        production_manager: productionManager || null,
        quality_manager: qualityManager || null,
        scheduled_at: scheduledAt || null,
      });
      toast.success('Lote creado');
      setProductionOrderId('');
      setArea('');
      setProductionLine('');
      setProductionManager('');
      setQualityManager('');
      setScheduledAt('');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el lote');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo lote" open={open} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          El lote se crea a partir de una orden de producción ya existente en el módulo de Inventario (Producción).
        </p>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">ID de la orden de producción</span>
          <input value={productionOrderId} onChange={(e) => setProductionOrderId(e.target.value)} className={inputCls} placeholder="UUID de la orden" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Área</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Línea</span>
            <input value={productionLine} onChange={(e) => setProductionLine(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Responsable de producción</span>
            <select value={productionManager} onChange={(e) => setProductionManager(e.target.value)} className={selectCls}>
              <option value="">Sin asignar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{`${employee.first_name} ${employee.last_name}`.trim()}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Responsable de calidad</span>
            <select value={qualityManager} onChange={(e) => setQualityManager(e.target.value)} className={selectCls}>
              <option value="">Sin asignar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{`${employee.first_name} ${employee.last_name}`.trim()}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Fecha programada</span>
          <input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}>
            {saving ? 'Creando...' : 'Crear lote'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function BatchDetail({
  batch,
  employeeById,
  onBack,
  onRefresh,
}: {
  batch: BatchRecord;
  employeeById: Map<string, Employee>;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<BatchTab>('general');
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startBatch(batch.id);
      toast.success('Lote iniciado');
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar el lote');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 mb-1">← Volver a lotes</button>
          <h2 className="text-lg font-semibold text-gray-900">{batch.batch_code || batch.production_order_number}</h2>
          <p className="text-xs text-gray-500">{batch.production_order_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge label={STATUS_LABELS[batch.status]} color={statusBadgeColor(batch.status)} />
          {!batch.actual_start_at && (
            <PrimaryButton onClick={() => void handleStart()} disabled={starting} icon={starting ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}>
              {starting ? 'Iniciando...' : 'Iniciar lote'}
            </PrimaryButton>
          )}
        </div>
      </div>

      <BatchProgressBar status={batch.status} />

      <TabBar tabs={BATCH_TABS} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && <GeneralTab batch={batch} employeeById={employeeById} onRefresh={onRefresh} />}
      {activeTab === 'dispensing' && <DispensingTab batch={batch} employeeById={employeeById} />}
      {activeTab === 'manufacturing' && <ManufacturingTab batch={batch} employeeById={employeeById} />}
      {activeTab === 'bulk_quality' && <BulkQualityTab batch={batch} />}
      {activeTab === 'filling' && <FillingTab batch={batch} />}
      {activeTab === 'packaging' && <PackagingTab batch={batch} />}
      {activeTab === 'final_quality' && <FinalQualityTab batch={batch} />}
      {activeTab === 'documents' && <DocumentsTab batch={batch} />}
      {activeTab === 'release' && <ReleaseTab batch={batch} employeeById={employeeById} onRefresh={onRefresh} />}
      {activeTab === 'history' && <HistoryTab batch={batch} />}
    </div>
  );
}

function BatchProgressBar({ status }: { status: BatchStatus }) {
  const index = STATUS_ORDER.indexOf(status);
  const percentage = index >= 0 ? Math.round(((index + 1) / STATUS_ORDER.length) * 100) : 100;
  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-700">Avance del proceso</p>
        <p className="text-xs text-gray-400">{percentage}%</p>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#2a4038] transition-all" style={{ width: `${percentage}%` }} />
      </div>
    </Card>
  );
}

function SectionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

function GeneralTab({
  batch,
  employeeById,
  onRefresh,
}: {
  batch: BatchRecord;
  employeeById: Map<string, Employee>;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState<BatchStatus>(batch.status);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangeStatus = async () => {
    setSaving(true);
    try {
      await changeBatchStatus(batch.id, { status: nextStatus, reason });
      toast.success('Estado actualizado');
      setShowStatusModal(false);
      setReason('');
      await onRefresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">Datos de la orden</p>
          <SecondaryButton onClick={() => setShowStatusModal(true)}>Cambiar estado</SecondaryButton>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionField label="Orden de producción" value={batch.production_order_number} />
          <SectionField label="Lote" value={batch.batch_code || 'Sin asignar'} />
          <SectionField label="Estado" value={STATUS_LABELS[batch.status]} />
          <SectionField label="Área" value={batch.area || 'Sin asignar'} />
          <SectionField label="Línea" value={batch.production_line || 'Sin asignar'} />
          <SectionField label="Responsable de producción" value={getEmployeeName(employeeById.get(batch.production_manager ?? ''))} />
          <SectionField label="Responsable de calidad" value={getEmployeeName(employeeById.get(batch.quality_manager ?? ''))} />
          <SectionField label="Fecha programada" value={formatDate(batch.scheduled_at)} />
          <SectionField label="Fecha real de inicio" value={formatDateTime(batch.actual_start_at)} />
          <SectionField label="Fecha real de terminación" value={formatDateTime(batch.actual_end_at)} />
        </div>
        {batch.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <SectionField label="Observaciones" value={batch.notes} />
          </div>
        )}
      </Card>

      <Modal title="Cambiar estado del lote" open={showStatusModal} onClose={() => setShowStatusModal(false)}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nuevo estado</span>
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as BatchStatus)} className={selectCls}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Motivo</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </label>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowStatusModal(false)}>Cancelar</SecondaryButton>
            <PrimaryButton onClick={() => void handleChangeStatus()} disabled={saving}>
              {saving ? 'Guardando...' : 'Confirmar cambio'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DispensingTab({ batch, employeeById }: { batch: BatchRecord; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [order, setOrder] = useState<DispensingOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [weighModalLineId, setWeighModalLineId] = useState<string | null>(null);
  const [grossWeight, setGrossWeight] = useState('');
  const [tare, setTare] = useState('');
  const [container, setContainer] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDispensingOrderByBatch(batch.id);
      setOrder(result);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la dispensación');
    } finally {
      setLoading(false);
    }
  }, [batch.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleWeigh = async () => {
    if (!weighModalLineId) return;
    try {
      await weighDispensingLine(weighModalLineId, {
        gross_weight: Number(grossWeight),
        tare: Number(tare),
        container,
      });
      toast.success('Pesada registrada');
      setWeighModalLineId(null);
      setGrossWeight('');
      setTare('');
      setContainer('');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la pesada');
    }
  };

  const handleVerify = async (lineId: string) => {
    try {
      await verifyDispensingLine(lineId);
      toast.success('Línea verificada');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo verificar la línea');
    }
  };

  const handleExport = async () => {
    if (!order) return;
    try {
      await exportDispensingOrder(order.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar la orden de dispensación');
    }
  };

  if (loading) return <LoadingState label="Cargando dispensación..." />;
  if (!order) return <EmptyState title="Sin orden de dispensación registrada para este lote" />;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Orden de dispensación</p>
          <p className="text-xs text-gray-400">
            Responsable: {getEmployeeName(employeeById.get(order.responsible ?? ''))} · Verificador: {getEmployeeName(employeeById.get(order.verifier ?? ''))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge label={order.status} color={order.status === 'COMPLETED' ? 'green' : 'yellow'} />
          <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Materia prima</th>
              <th className="py-2 pr-3">Teórica</th>
              <th className="py-2 pr-3">Pesada</th>
              <th className="py-2 pr-3">Desv. %</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-50">
                <td className="py-2 pr-3">{line.sequence}</td>
                <td className="py-2 pr-3">{line.item}</td>
                <td className="py-2 pr-3">{line.theoretical_quantity}</td>
                <td className="py-2 pr-3">{line.net_weight ?? '-'}</td>
                <td className={`py-2 pr-3 ${line.is_within_tolerance === false ? 'text-red-600 font-semibold' : ''}`}>
                  {line.deviation_percentage !== null ? `${line.deviation_percentage.toFixed(2)}%` : '-'}
                </td>
                <td className="py-2 pr-3">
                  <Badge label={line.status} color={line.status === 'VERIFIED' || line.status === 'CLOSED' ? 'green' : 'yellow'} />
                </td>
                <td className="py-2 pr-3">
                  {line.status === 'PENDING' && (
                    <button onClick={() => setWeighModalLineId(line.id)} className="text-[#2a4038] hover:underline">Pesar</button>
                  )}
                  {line.status === 'WEIGHED' && (
                    <button onClick={() => void handleVerify(line.id)} className="text-[#2a4038] hover:underline">Verificar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Registrar pesada" open={Boolean(weighModalLineId)} onClose={() => setWeighModalLineId(null)}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tara</span>
            <input type="number" step="0.001" value={tare} onChange={(e) => setTare(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Peso bruto</span>
            <input type="number" step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Recipiente</span>
            <input value={container} onChange={(e) => setContainer(e.target.value)} className={inputCls} />
          </label>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setWeighModalLineId(null)}>Cancelar</SecondaryButton>
            <PrimaryButton onClick={() => void handleWeigh()}>Guardar pesada</PrimaryButton>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function ManufacturingTab({ batch, employeeById }: { batch: BatchRecord; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [clearances, setClearances] = useState<LineClearanceRecord[]>([]);
  const [cleanings, setCleanings] = useState<CleaningRecordRecord[]>([]);
  const [lineIdentification, setLineIdentification] = useState<LineIdentificationRecord | null>(null);
  const [steps, setSteps] = useState<ManufacturingStepExecutionRecord[]>([]);
  const [productionControl, setProductionControl] = useState<ProductionControlRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      getLineClearances(batch.id),
      getCleaningRecords(batch.id),
      getLineIdentification(batch.id),
      getManufacturingStepExecutions(batch.id),
      getProductionControl(batch.id),
    ]).then(([clearancesRes, cleaningsRes, lineRes, stepsRes, controlRes]) => {
      if (cancelled) return;
      if (clearancesRes.status === 'fulfilled') setClearances(clearancesRes.value);
      if (cleaningsRes.status === 'fulfilled') setCleanings(cleaningsRes.value);
      if (lineRes.status === 'fulfilled') setLineIdentification(lineRes.value);
      if (stepsRes.status === 'fulfilled') setSteps(stepsRes.value);
      if (controlRes.status === 'fulfilled') setProductionControl(controlRes.value);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        toast.error('No se pudo cargar la información de fabricación');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [batch.id, toast]);

  const handleApprove = async (id: string) => {
    try {
      await approveLineClearance(id);
      toast.success('Despeje aprobado');
      setClearances(await getLineClearances(batch.id));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo aprobar el despeje');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectLineClearance(id);
      toast.info('Despeje rechazado');
      setClearances(await getLineClearances(batch.id));
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

  if (loading) return <LoadingState label="Cargando fabricación..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Despejes de línea</p>
        {clearances.length === 0 ? (
          <EmptyState title="Sin despejes registrados" />
        ) : (
          <div className="space-y-2">
            {clearances.map((clearance) => (
              <div key={clearance.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{clearance.phase}</p>
                  <p className="text-[11px] text-gray-400">Área: {clearance.area || '-'} · {formatDateTime(clearance.cleared_at)}</p>
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
        <p className="text-sm font-semibold text-gray-900 mb-3">Limpieza de áreas y equipos</p>
        {cleanings.length === 0 ? (
          <EmptyState title="Sin registros de limpieza" />
        ) : (
          <div className="space-y-2">
            {cleanings.map((record) => (
              <div key={record.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{record.record_type === 'AREA' ? record.area : record.equipment}</p>
                  <p className="text-[11px] text-gray-400">Sanitizante: {record.sanitizer || '-'} · {formatDateTime(record.cleaned_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {record.is_expired && <Badge label="Vencida" color="red" />}
                  {record.result && <Badge label={record.result} color={record.result === 'APPROVED' ? 'green' : 'red'} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Identificación de línea</p>
        {lineIdentification ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <SectionField label="Área" value={lineIdentification.area || 'Sin asignar'} />
            <SectionField label="Línea" value={lineIdentification.production_line || 'Sin asignar'} />
            <SectionField label="Colocada" value={formatDateTime(lineIdentification.placed_at)} />
            <SectionField label="Retirada" value={formatDateTime(lineIdentification.removed_at)} />
          </div>
        ) : (
          <EmptyState title="Sin identificación de línea registrada" />
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Instrucciones de fabricación</p>
        {steps.length === 0 ? (
          <EmptyState title="Sin pasos de fabricación ejecutados" description="Los pasos provienen de la fórmula maestra del producto." />
        ) : (
          <div className="space-y-2">
            {steps.map((execution) => (
              <div key={execution.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-900">Paso {execution.step_detail.sequence}. {execution.step_detail.phase || '-'}</p>
                  <Badge label={execution.status} color={execution.status === 'COMPLETED' ? 'green' : execution.status === 'DEVIATED' ? 'red' : 'yellow'} />
                </div>
                <p className="text-[11px] text-gray-400">{execution.step_detail.instruction}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Control de producción (materiales de acondicionamiento)</p>
        {!productionControl || productionControl.materials.length === 0 ? (
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
                {productionControl.materials.map((material) => (
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
      </Card>
    </div>
  );
}

function BulkQualityTab({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [certificate, setCertificate] = useState<AnalysisCertificateRecord | null>(null);
  const [microbiology, setMicrobiology] = useState<MicrobiologyAnalysisRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getAnalysisCertificate(batch.id), getMicrobiologyAnalysis(batch.id)]).then(([certRes, microRes]) => {
      if (cancelled) return;
      if (certRes.status === 'fulfilled') setCertificate(certRes.value);
      if (microRes.status === 'fulfilled') setMicrobiology(microRes.value);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [batch.id]);

  const handleExport = async () => {
    if (!certificate) return;
    try {
      await exportAnalysisCertificate(certificate.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el certificado');
    }
  };

  if (loading) return <LoadingState label="Cargando calidad del granel..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Certificado de análisis</p>
          {certificate && <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>}
        </div>
        {!certificate ? (
          <EmptyState title="Sin certificado de análisis registrado" />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Badge label={certificate.concept} color={certificate.concept === 'APPROVED' ? 'green' : certificate.concept === 'REJECTED' ? 'red' : 'yellow'} />
              <p className="text-xs text-gray-400">Analizado: {formatDate(certificate.analyzed_at)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-3">Ensayo</th>
                    <th className="py-2 pr-3">Especificación</th>
                    <th className="py-2 pr-3">Granel</th>
                    <th className="py-2 pr-3">Terminado</th>
                    <th className="py-2 pr-3">Cumple</th>
                  </tr>
                </thead>
                <tbody>
                  {certificate.tests.map((test) => (
                    <tr key={test.id} className="border-b border-gray-50">
                      <td className="py-2 pr-3">{test.name}</td>
                      <td className="py-2 pr-3">{test.specification}</td>
                      <td className="py-2 pr-3">{test.bulk_result}</td>
                      <td className="py-2 pr-3">{test.finished_product_result}</td>
                      <td className="py-2 pr-3">
                        {test.complies === null ? '-' : <Badge label={test.complies ? 'Cumple' : 'No cumple'} color={test.complies ? 'green' : 'red'} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Análisis microbiológico</p>
        {!microbiology ? (
          <EmptyState title="Sin análisis microbiológico registrado" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <SectionField label="Laboratorio" value={microbiology.laboratory || '-'} />
            <SectionField label="N.º informe" value={microbiology.report_number || '-'} />
            <SectionField label="Resultado general" value={microbiology.overall_result} />
            <SectionField label="Fecha de aprobación" value={formatDate(microbiology.approved_at)} />
          </div>
        )}
      </Card>
    </div>
  );
}

function FillingTab({ batch }: { batch: BatchRecord }) {
  const [control, setControl] = useState<FillingControlRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFillingControl(batch.id).then((result) => {
      if (!cancelled) {
        setControl(result);
        setLoading(false);
      }
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [batch.id]);

  if (loading) return <LoadingState label="Cargando llenado..." />;
  if (!control) return <EmptyState title="Sin control de llenado registrado" />;

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-gray-900 mb-3">Control de llenado</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <SectionField label="Línea" value={control.production_line || '-'} />
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
    </Card>
  );
}

function PackagingTab({ batch }: { batch: BatchRecord }) {
  const [control, setControl] = useState<PackagingControlRecord | null>(null);
  const [seal, setSeal] = useState<SealIntegrityControlRecord | null>(null);
  const [weight, setWeight] = useState<WeightVolumeControlRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getPackagingControl(batch.id), getSealIntegrityControl(batch.id), getWeightVolumeControl(batch.id)]).then(
      ([packagingRes, sealRes, weightRes]) => {
        if (cancelled) return;
        if (packagingRes.status === 'fulfilled') setControl(packagingRes.value);
        if (sealRes.status === 'fulfilled') setSeal(sealRes.value);
        if (weightRes.status === 'fulfilled') setWeight(weightRes.value);
        setLoading(false);
      },
    );
    return () => { cancelled = true; };
  }, [batch.id]);

  if (loading) return <LoadingState label="Cargando acondicionamiento..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Control de acondicionamiento</p>
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
            <p className="text-xs font-semibold text-gray-700 mb-2">Loteado</p>
            <div className="space-y-2">
              {control.lot_markings.length === 0 ? (
                <p className="text-xs text-gray-400">Sin registros de loteado.</p>
              ) : (
                control.lot_markings.map((marking) => (
                  <div key={marking.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{marking.stage === 'INITIAL' ? 'Loteado inicial' : 'Loteado final'}</p>
                      <p className="text-[11px] text-gray-400">{marking.printed_batch_code || '-'}</p>
                    </div>
                    {marking.result && <Badge label={marking.result} color={marking.result === 'YES' ? 'green' : marking.result === 'NO' ? 'red' : 'gray'} />}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Control de hermeticidad</p>
          {!seal ? <EmptyState title="Sin registro" /> : (
            <div className="space-y-2">
              <Badge label={seal.overall_result} color={seal.overall_result === 'APPROVED' ? 'green' : seal.overall_result === 'REJECTED' ? 'red' : 'yellow'} />
              <SectionField label="Presión (bar)" value={seal.pressure_bar ?? '-'} />
              <SectionField label="Tiempo (s)" value={String(seal.time_seconds ?? '-')} />
            </div>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Control de peso o volumen</p>
          {!weight ? <EmptyState title="Sin registro" /> : (
            <div className="space-y-2">
              <Badge label={weight.overall_result} color={weight.overall_result === 'APPROVED' ? 'green' : weight.overall_result === 'REJECTED' ? 'red' : 'yellow'} />
              <SectionField label="Límite inferior" value={weight.lower_limit ?? '-'} />
              <SectionField label="Límite superior" value={weight.upper_limit ?? '-'} />
              <p className="text-xs text-gray-400">{weight.samples.length} muestra(s) registradas</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FinalQualityTab({ batch }: { batch: BatchRecord }) {
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

function DocumentsTab({ batch }: { batch: BatchRecord }) {
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

function ReleaseTab({
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

  if (!release) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Liberación de producto terminado</p>
        <p className="text-xs text-gray-500 mb-4">
          Antes de liberar se validan automáticamente: certificado de análisis aprobado, microbiología, peso/volumen, hermeticidad,
          despejes de línea y documentos obligatorios del expediente.
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
    );
  }

  return (
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
  );
}

function HistoryTab({ batch }: { batch: BatchRecord }) {
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
