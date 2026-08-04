import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Loader2,
  Package,
  PlayCircle,
  Plus,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  Badge,
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
import { AdminProductionPlanning } from './AdminProductionPlanning';
import {
  createBatch,
  createBatchWithOrder,
  exportBatchDossier,
  getAreas,
  getBatches,
  getProductionLines,
  startBatch,
  type AreaRecord,
  type BatchRecord,
  type ProductionLineRecord,
} from '../../services/manufacturing.service';
import { getEmployees, type Employee } from '../../services/employees.service';
import { getFormulas, getProductionOrders, type FormulaRecord, type ProductionOrderRecord } from '../../services/inventory-production.service';
import {
  BATCH_TABS,
  MANUFACTURING_SECTIONS,
  STATUS_LABELS,
  STATUS_TO_CURRENT_TAB,
  BatchProgressBar,
  batchProgressPercentage,
  formatDate,
  getEmployeeName,
  nextStepLabel,
  statusBadgeColor,
  type BatchTab,
  type ManufacturingSection,
} from './manufacturing-shared';
import { GeneralTab } from './manufacturing-tab-general';
import { DocumentsTab } from './manufacturing-tab-release';
import { ProductionControlTab } from './manufacturing-tab-production-control';
import { LineIdentificationTab } from './manufacturing-tab-line-identification';
import { CleaningLateTab } from './manufacturing-tab-cleaning-late';
import { ClearanceEarlyTab } from './manufacturing-tab-clearance-early';
import { AnalysisCertificateTab } from './manufacturing-tab-analysis-certificate';
import { PackagingControlTab } from './manufacturing-tab-packaging';
import { CleaningEarlyTab } from './manufacturing-tab-cleaning-early';
import { DispensingTab } from './manufacturing-tab-dispensing';
import { ManufacturingTab } from './manufacturing-tab-manufacturing';
import { FillingTab } from './manufacturing-tab-filling';
import { WeightVolumeTab } from './manufacturing-tab-weight-volume';
import { ClearanceLateTab } from './manufacturing-tab-clearance-late';
import { SealIntegrityTab } from './manufacturing-tab-seal-integrity';
import { RawMaterialIdentificationTab } from './manufacturing-tab-raw-material-identification';
import { FinalQualityTab, ReleaseTab, HistoryTab } from './manufacturing-tab-release';

/* ═══════════════════════════════════════════════════════
   MÓDULO DE PRODUCCIÓN — orquestación de secciones (Planificación /
   Expedientes de lote) y el detalle de lote (19 pestañas, calcadas del
   SOP físico real de la empresa, repartidas en manufacturing-tab-*.tsx).
═══════════════════════════════════════════════════════ */

export function AdminManufacturing() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ManufacturingSection>('planning');
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderRecord[]>([]);
  const [formulas, setFormulas] = useState<FormulaRecord[]>([]);
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLineRecord[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchRecord | null>(null);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [planningRefreshKey, setPlanningRefreshKey] = useState(0);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const availableProductionOrders = useMemo(() => {
    const assignedOrderIds = new Set(batches.map((batch) => batch.production_order));
    return productionOrders.filter((order) => !assignedOrderIds.has(order.id));
  }, [productionOrders, batches]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [batchesRes, employeesRes, productionOrdersRes, formulasRes, areasRes, productionLinesRes] = await Promise.allSettled([
        getBatches(),
        getEmployees({ limit: 500 }),
        getProductionOrders(),
        getFormulas(),
        getAreas(),
        getProductionLines(),
      ]);
      if (batchesRes.status === 'fulfilled') setBatches(batchesRes.value);
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
      if (productionOrdersRes.status === 'fulfilled') setProductionOrders(productionOrdersRes.value);
      if (formulasRes.status === 'fulfilled') setFormulas(formulasRes.value);
      if (areasRes.status === 'fulfilled') setAreas(areasRes.value);
      if (productionLinesRes.status === 'fulfilled') setProductionLines(productionLinesRes.value);
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
        subtitle="Planificación, fórmulas, órdenes y expediente completo de fabricación de lotes."
        onNew={activeSection === 'batches' ? () => setShowNewBatchModal(true) : undefined}
        newLabel="Nuevo lote"
      />

      <TabBar tabs={MANUFACTURING_SECTIONS} value={activeSection} onChange={setActiveSection} />
      <p className="text-xs text-gray-400 -mt-4 mb-5">
        {activeSection === 'planning'
          ? 'Aquí defines fórmulas/recetas y consultas el estado general (Pendiente / En proceso / Cerrada) de las órdenes de producción.'
          : 'Aquí ejecutas y documentas el proceso de cada lote paso a paso: dispensación, fabricación, calidad, llenado, acondicionamiento y liberación.'}
      </p>

      {activeSection === 'planning' && (
        <AdminProductionPlanning
          refreshKey={planningRefreshKey}
          onCreateBatch={() => setShowNewBatchModal(true)}
        />
      )}

      {activeSection === 'batches' && (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Lotes totales" value={String(stats.total)} icon={Package} color="text-gray-600 bg-gray-100" />
        <KpiCard label="En proceso" value={String(stats.active)} icon={Loader2} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Liberados" value={String(stats.released)} icon={CheckCircle2} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Rechazados" value={String(stats.rejected)} icon={AlertTriangle} color="text-red-600 bg-red-50" />
      </div>

      {batches.length === 0 ? (
        <EmptyState
          title="No hay lotes registrados"
          description="Crea un lote nuevo eligiendo una fórmula y cantidad, o a partir de una orden de producción ya existente."
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
                  <p>Área: {batch.area_name || 'Sin asignar'}</p>
                  <p>Línea: {batch.production_line_name || 'Sin asignar'}</p>
                  <p>Responsable: {getEmployeeName(employeeById.get(batch.production_manager ?? ''))}</p>
                  <p>Programada: {formatDate(batch.scheduled_at)}</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#2a4038]" style={{ width: `${batchProgressPercentage(batch.status)}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400">{batchProgressPercentage(batch.status)}%</span>
                </div>
                <p className="text-[11px] font-semibold text-[#2a4038] mt-1.5">{nextStepLabel(batch.status)}</p>
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
        </>
      )}

      <NewBatchModal
        open={showNewBatchModal}
        employees={employees}
        productionOrders={availableProductionOrders}
        formulas={formulas}
        areas={areas}
        productionLines={productionLines}
        onClose={() => setShowNewBatchModal(false)}
        onCreated={async () => {
          setShowNewBatchModal(false);
          setPlanningRefreshKey((key) => key + 1);
          await loadData();
        }}
      />
    </div>
  );
}

function NewBatchModal({
  open,
  employees,
  productionOrders,
  formulas,
  areas,
  productionLines,
  onClose,
  onCreated,
}: {
  open: boolean;
  employees: Employee[];
  productionOrders: ProductionOrderRecord[];
  formulas: FormulaRecord[];
  areas: AreaRecord[];
  productionLines: ProductionLineRecord[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<'formula' | 'existing_order'>('formula');
  const [formulaId, setFormulaId] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [productionOrderId, setProductionOrderId] = useState('');
  const [area, setArea] = useState('');
  const [productionLine, setProductionLine] = useState('');
  const [productionManager, setProductionManager] = useState('');
  const [qualityManager, setQualityManager] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormulaId('');
    setPlannedQuantity('');
    setBatchCode('');
    setProductionOrderId('');
    setArea('');
    setProductionLine('');
    setProductionManager('');
    setQualityManager('');
    setScheduledAt('');
  };

  const handleSubmit = async () => {
    if (mode === 'formula') {
      if (!formulaId || !Number(plannedQuantity)) {
        toast.error('Selecciona una fórmula e indica la cantidad planificada');
        return;
      }
      setSaving(true);
      try {
        await createBatchWithOrder({
          formula: formulaId,
          planned_quantity: Number(plannedQuantity),
          batch_code: batchCode,
          area: area || null,
          production_line: productionLine || null,
          production_manager: productionManager || null,
          quality_manager: qualityManager || null,
          scheduled_at: scheduledAt || null,
        });
        toast.success('Lote y orden de producción creados');
        resetForm();
        await onCreated();
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'No se pudo crear el lote');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!productionOrderId) {
      toast.error('Debes seleccionar una orden de producción');
      return;
    }
    setSaving(true);
    try {
      await createBatch({
        production_order: productionOrderId,
        area: area || null,
        production_line: productionLine || null,
        production_manager: productionManager || null,
        quality_manager: qualityManager || null,
        scheduled_at: scheduledAt || null,
      });
      toast.success('Lote creado');
      resetForm();
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el lote');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = mode === 'formula' ? Boolean(formulaId && Number(plannedQuantity)) : Boolean(productionOrderId);

  return (
    <Modal title="Nuevo lote" open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setMode('formula')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === 'formula' ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Crear con fórmula
          </button>
          <button
            type="button"
            onClick={() => setMode('existing_order')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === 'existing_order' ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Usar orden existente
          </button>
        </div>

        {mode === 'formula' ? (
          <>
            <p className="text-xs text-gray-500">
              Se creará la orden de producción y el expediente del lote en un solo paso.
            </p>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Fórmula / Receta <span className="text-red-500">*</span></span>
              <select value={formulaId} onChange={(e) => setFormulaId(e.target.value)} className={selectCls}>
                <option value="">Seleccionar fórmula...</option>
                {formulas.map((formula) => (
                  <option key={formula.id} value={formula.id}>{formula.code} — {formula.name}</option>
                ))}
              </select>
              {formulas.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  No hay fórmulas registradas. Crea una en la pestaña Planificación.
                </p>
              )}
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Cantidad planificada <span className="text-red-500">*</span></span>
                <input type="number" value={plannedQuantity} onChange={(e) => setPlannedQuantity(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Código de lote</span>
                <input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className={inputCls} placeholder="Ej: PT2025-022" />
              </label>
            </div>
          </>
        ) : (
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Orden de producción <span className="text-red-500">*</span></span>
            <select value={productionOrderId} onChange={(e) => setProductionOrderId(e.target.value)} className={selectCls}>
              <option value="">Seleccionar orden...</option>
              {productionOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.number}{order.batch_code ? ` · ${order.batch_code}` : ''}
                </option>
              ))}
            </select>
            {productionOrders.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                No hay órdenes de producción disponibles sin lote asignado.
              </p>
            )}
          </label>
        )}

        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 pt-2 border-t border-gray-100">
          Asignación (opcional, puedes completarla después)
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
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
        <div className="grid sm:grid-cols-2 gap-3">
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
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving || !canSubmit} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}>
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
  const currentPhaseTab = STATUS_TO_CURRENT_TAB[batch.status];
  const [activeTab, setActiveTab] = useState<BatchTab>(currentPhaseTab);
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
        <div className="flex items-center gap-3">
          <div className="text-right">
            <Badge label={STATUS_LABELS[batch.status]} color={statusBadgeColor(batch.status)} />
            <p className="text-[11px] text-gray-400 mt-1">{nextStepLabel(batch.status)}</p>
          </div>
          {!batch.actual_start_at && (
            <PrimaryButton onClick={() => void handleStart()} disabled={starting} icon={starting ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}>
              {starting ? 'Iniciando...' : 'Iniciar lote'}
            </PrimaryButton>
          )}
        </div>
      </div>

      <BatchProgressBar status={batch.status} />

      <TabBar tabs={BATCH_TABS} value={activeTab} onChange={setActiveTab} currentId={currentPhaseTab} compact />

      {activeTab === 'general' && <GeneralTab batch={batch} employeeById={employeeById} onRefresh={onRefresh} />}
      {activeTab === 'documents' && <DocumentsTab batch={batch} onNavigateToTab={setActiveTab} />}
      {activeTab === 'production_control' && <ProductionControlTab batch={batch} employeeById={employeeById} employees={Array.from(employeeById.values())} />}
      {activeTab === 'line_identification' && <LineIdentificationTab batch={batch} />}
      {activeTab === 'cleaning_late' && <CleaningLateTab batch={batch} />}
      {activeTab === 'clearance_early' && <ClearanceEarlyTab batch={batch} />}
      {activeTab === 'analysis_certificate' && <AnalysisCertificateTab batch={batch} />}
      {activeTab === 'packaging_control' && <PackagingControlTab batch={batch} employeeById={employeeById} employees={Array.from(employeeById.values())} />}
      {activeTab === 'cleaning_early' && <CleaningEarlyTab batch={batch} />}
      {activeTab === 'dispensing' && <DispensingTab batch={batch} employeeById={employeeById} />}
      {activeTab === 'manufacturing' && <ManufacturingTab batch={batch} />}
      {activeTab === 'filling' && <FillingTab batch={batch} employeeById={employeeById} />}
      {activeTab === 'weight_volume' && <WeightVolumeTab batch={batch} />}
      {activeTab === 'clearance_late' && <ClearanceLateTab batch={batch} />}
      {activeTab === 'seal_integrity' && <SealIntegrityTab batch={batch} />}
      {activeTab === 'raw_material_identification' && <RawMaterialIdentificationTab batch={batch} />}
      {activeTab === 'final_quality' && <FinalQualityTab batch={batch} />}
      {activeTab === 'release' && <ReleaseTab batch={batch} employeeById={employeeById} onRefresh={onRefresh} />}
      {activeTab === 'history' && <HistoryTab batch={batch} />}
    </div>
  );
}

