import { api, API_BASE_URL, getAccessToken } from './api';

const BASE = '/manufacturing';

type UUID = string;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function getPage<T>(path: string): Promise<T[]> {
  const firstResponse = await api.get<PaginatedResponse<T>>(`${path}?page_size=100`);
  const firstPage = firstResponse.data;
  if (!firstPage) return [];

  const totalPages = Math.ceil(firstPage.count / 100);
  if (totalPages <= 1) return firstPage.results;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      api.get<PaginatedResponse<T>>(`${path}?page_size=100&page=${index + 2}`),
    ),
  );

  return [
    ...firstPage.results,
    ...remainingPages.flatMap(response => response.data?.results ?? []),
  ];
}

async function downloadBlob(url: string, filename: string, options: RequestInit = {}): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
  }
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error('No se pudo generar el documento.');
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

// ── Tipos ──────────────────────────────────────────────────────────────────

export type BatchStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PENDING_DISPENSING'
  | 'DISPENSING'
  | 'DISPENSING_DONE'
  | 'MANUFACTURING'
  | 'BULK_PENDING_ANALYSIS'
  | 'BULK_APPROVED'
  | 'FILLING'
  | 'PACKAGING'
  | 'FINISHED_QUARANTINE'
  | 'PENDING_DOCUMENTS'
  | 'PENDING_MICROBIOLOGY'
  | 'RELEASED'
  | 'REJECTED'
  | 'CLOSED'
  | 'CANCELLED';

export type ResultStatus = 'YES' | 'NO' | 'NOT_APPLICABLE';

export interface BatchStatusHistoryRecord {
  id: UUID;
  batch: UUID;
  previous_status: string;
  new_status: string;
  changed_by: UUID | null;
  reason: string;
  observation: string;
  evidence: string | null;
  created_at: string;
}

export interface BatchRecord {
  id: UUID;
  production_order: UUID;
  production_order_number: string;
  batch_code: string;
  status: BatchStatus;
  area: string;
  production_line: string;
  production_manager: UUID | null;
  quality_manager: UUID | null;
  scheduled_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  notes: string;
  created_by: UUID | null;
  is_terminal: boolean;
  status_history: BatchStatusHistoryRecord[];
  created_at: string;
  updated_at: string;
}

export interface RawMaterialBatchRecord {
  id: UUID;
  item: UUID;
  supplier_batch_code: string;
  received_at: string | null;
  expires_at: string | null;
  analysis_number: string;
  quality_status: 'QUARANTINE' | 'APPROVED' | 'REJECTED';
  supplier: UUID | null;
  notes: string;
  is_expired: boolean;
  is_usable: boolean;
}

export interface ItemStockRecord {
  id: UUID;
  item: UUID;
  location: UUID;
  raw_material_batch: UUID | null;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
}

export interface DispensingLineRecord {
  id: UUID;
  order: UUID;
  sequence: number;
  formula_line: UUID | null;
  item: UUID;
  raw_material_batch: UUID | null;
  theoretical_quantity: string;
  tolerance_percentage: string;
  tare: string | null;
  gross_weight: string | null;
  net_weight: string | null;
  container: string;
  status: 'PENDING' | 'WEIGHED' | 'VERIFIED' | 'CLOSED';
  weighed_by: UUID | null;
  weighed_at: string | null;
  verified_by: UUID | null;
  verified_at: string | null;
  additional_quantity: string;
  returned_quantity: string;
  return_reason: string;
  observations: string;
  deviation_percentage: number | null;
  is_within_tolerance: boolean | null;
}

export interface DispensingOrderRecord {
  id: UUID;
  batch: UUID;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  issued_at: string | null;
  responsible: UUID | null;
  verifier: UUID | null;
  responsible_signature: string | null;
  verifier_signature: string | null;
  lines: DispensingLineRecord[];
  is_complete: boolean;
}

export interface LineClearanceCriterionRecord {
  id: UUID;
  clearance: UUID;
  criterion: string;
  result: ResultStatus;
  observation: string;
  evidence: string | null;
  corrective_action: string;
  corrected_at: string | null;
  reinspection_result: ResultStatus | '';
}

export interface LineClearanceRecord {
  id: UUID;
  batch: UUID;
  phase: 'DISPENSING' | 'MANUFACTURING' | 'FILLING' | 'PACKAGING';
  area: string;
  production_line: string;
  cleared_at: string | null;
  previous_product: string;
  previous_batch_code: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  performed_by: UUID | null;
  verified_by: UUID | null;
  criteria: LineClearanceCriterionRecord[];
}

export interface CleaningRecordRecord {
  id: UUID;
  batch: UUID;
  record_type: 'AREA' | 'EQUIPMENT';
  area: string;
  equipment: string;
  equipment_code: string;
  cleaned_at: string | null;
  previous_product: string;
  previous_batch_code: string;
  cleaning_method: string;
  sanitizer: string;
  sanitizer_concentration: string;
  sanitizer_batch: string;
  sanitizer_expires_at: string | null;
  performed_by: UUID | null;
  verified_by: UUID | null;
  result: 'APPROVED' | 'REJECTED' | null;
  observations: string;
  valid_until: string | null;
  is_expired: boolean;
}

export interface LineIdentificationRecord {
  id: UUID;
  batch: UUID;
  area: string;
  production_line: string;
  placed_at: string | null;
  placed_by: UUID | null;
  removed_at: string | null;
  removed_by: UUID | null;
}

export interface ManufacturingStepRecord {
  id: UUID;
  formula: UUID;
  sequence: number;
  phase: string;
  instruction: string;
  formula_line: UUID | null;
  required_equipment: string;
  target_temperature: string | null;
  target_time_minutes: number | null;
  target_agitation_speed: string;
  target_ph: string | null;
  target_pressure: string;
  is_mandatory: boolean;
}

export interface ManufacturingStepExecutionRecord {
  id: UUID;
  batch: UUID;
  step: UUID;
  step_detail: ManufacturingStepRecord;
  status: 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'DEVIATED';
  actual_quantity: string | null;
  actual_temperature: string | null;
  actual_time_minutes: number | null;
  actual_agitation_speed: string;
  actual_ph: string | null;
  actual_pressure: string;
  started_at: string | null;
  finished_at: string | null;
  performed_by: UUID | null;
  verified_by: UUID | null;
  observations: string;
  deviation: string;
}

export interface ProductionControlMaterialRecord {
  id: UUID;
  control: UUID;
  item: UUID;
  requested_quantity: string;
  delivered_quantity: string;
  delivered_by: UUID | null;
  received_by: UUID | null;
  delivered_at: string | null;
  returned_quantity: string;
  return_reason: string;
  additional_quantity: string;
  additional_reason: string;
  good_units: string;
  process_rejects: string;
  factory_rejects: string;
  observations: string;
  consumed_quantity: string;
  reconciliation_difference: string;
}

export interface ProductionControlRecord {
  id: UUID;
  batch: UUID;
  lot_size: string | null;
  unit: UUID | null;
  notes: string;
  materials: ProductionControlMaterialRecord[];
}

export interface FillingParticipantRecord {
  id: UUID;
  control: UUID;
  employee: UUID | null;
  role: string;
  activity: string;
  check_in: string | null;
  check_out: string | null;
  signature: string | null;
}

export interface FillingLogEntryRecord {
  id: UUID;
  control: UUID;
  recorded_at: string;
  units_produced: string;
  displays: string;
  boxes: string;
  units_rejected: string;
  rejection_reason: string;
  performed_by: UUID | null;
  verified_by: UUID | null;
  observations: string;
}

export interface FillingControlRecord {
  id: UUID;
  batch: UUID;
  production_line: string;
  equipment: string;
  source_tank: string;
  started_at: string | null;
  finished_at: string | null;
  responsible: UUID | null;
  verifier: UUID | null;
  planned_quantity: string | null;
  produced_quantity: string;
  rejected_quantity: string;
  recovered_quantity: string;
  justification: string;
  observations: string;
  participants: FillingParticipantRecord[];
  log_entries: FillingLogEntryRecord[];
  yield_percentage: number | null;
  difference: string | null;
}

export interface WeightVolumeSampleRecord {
  id: UUID;
  control: UUID;
  sample_number: number;
  sampled_at: string | null;
  gross_weight: string | null;
  tare: string | null;
  volume: string | null;
  result: ResultStatus;
  observation: string;
  adjustment_made: string;
  net_weight: string | null;
}

export interface WeightVolumeControlRecord {
  id: UUID;
  batch: UUID;
  tare: string | null;
  lower_limit: string | null;
  upper_limit: string | null;
  unit: UUID | null;
  performed_by: UUID | null;
  verified_by: UUID | null;
  overall_result: 'APPROVED' | 'REJECTED' | 'PENDING';
  resumed_authorized_by: UUID | null;
  samples: WeightVolumeSampleRecord[];
}

export interface SealIntegritySampleRecord {
  id: UUID;
  control: UUID;
  sample_number: number;
  result: 'CONFORMING' | 'LEAK' | 'DEFORMATION' | 'RUPTURE' | 'OTHER';
  observation: string;
  evidence: string | null;
}

export interface SealIntegrityControlRecord {
  id: UUID;
  batch: UUID;
  tested_at: string | null;
  equipment: string;
  equipment_code: string;
  pressure_bar: string | null;
  time_seconds: number | null;
  performed_by: UUID | null;
  verified_by: UUID | null;
  observations: string;
  overall_result: 'APPROVED' | 'REJECTED' | 'REPEAT' | 'PENDING';
  samples: SealIntegritySampleRecord[];
}

export interface BatchLotMarkingRecord {
  id: UUID;
  packaging_control: UUID;
  stage: 'INITIAL' | 'FINAL';
  photo: string | null;
  printed_batch_code: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  printed_at: string | null;
  is_legible: boolean | null;
  is_correctly_placed: boolean | null;
  result: ResultStatus | '';
  performed_by: UUID | null;
  verified_by: UUID | null;
}

export interface PackagingControlRecord {
  id: UUID;
  batch: UUID;
  responsible: UUID | null;
  verifier: UUID | null;
  label_sample_file: string | null;
  label_code: string;
  artwork_version: string;
  label_material_batch: string;
  label_result: ResultStatus | '';
  label_observations: string;
  units_per_display: number | null;
  displays_per_box: number | null;
  units_per_box: number | null;
  complete_boxes: number;
  incomplete_displays: number;
  loose_units: number;
  total_reconciled: string;
  balances: string;
  rejections: string;
  rejection_reasons: string;
  lot_markings: BatchLotMarkingRecord[];
}

export interface AnalysisTestResultRecord {
  id: UUID;
  certificate: UUID;
  name: string;
  result_type: string;
  unit: string;
  specification: string;
  lower_limit: string;
  upper_limit: string;
  method: string;
  equipment: string;
  equipment_parameters: string;
  bulk_result: string;
  finished_product_result: string;
  complies: boolean | null;
  observations: string;
  performed_by: UUID | null;
  verified_by: UUID | null;
}

export interface AnalysisCertificateRecord {
  id: UUID;
  batch: UUID;
  manufactured_at: string | null;
  sampled_at: string | null;
  analyzed_at: string | null;
  analyzed_by: UUID | null;
  verified_by: UUID | null;
  concept: 'APPROVED' | 'REJECTED' | 'QUARANTINE' | 'REANALYSIS';
  observations: string;
  tests: AnalysisTestResultRecord[];
}

export interface MicrobiologyAnalysisRecord {
  id: UUID;
  batch: UUID;
  sample_code: string;
  sample_type: string;
  taken_at: string | null;
  taken_by: UUID | null;
  sent_at: string | null;
  laboratory: string;
  report_number: string;
  results: unknown[];
  specifications: unknown[];
  overall_result: 'APPROVED' | 'REJECTED' | 'PENDING';
  report_file: string | null;
  approved_at: string | null;
  approved_by: UUID | null;
  observations: string;
}

export type DocumentCode =
  | 'PRODUCTION_CONTROL'
  | 'LINE_CLEARANCE'
  | 'CLEAN_AREA_EQUIPMENT'
  | 'DISPENSING_ORDER'
  | 'RAW_MATERIAL_IDENTIFICATION'
  | 'ANALYSIS_CERTIFICATE'
  | 'MICROBIOLOGY'
  | 'LINE_IDENTIFICATION'
  | 'FILLING_CONTROL'
  | 'RELEASE'
  | 'PACKAGING_CONTROL'
  | 'SEAL_INTEGRITY'
  | 'WEIGHT_VOLUME';

export interface DocumentChecklistItemRecord {
  id: UUID;
  batch: UUID;
  document_code: DocumentCode;
  name: string;
  format_code: string;
  format_version: string;
  applies: boolean;
  result: ResultStatus;
  status: 'PENDING' | 'IN_PROGRESS' | 'FILLED' | 'REVIEWED' | 'APPROVED' | 'REJECTED';
  responsible: UUID | null;
  verifier: UUID | null;
  filled_at: string | null;
  verified_at: string | null;
  observations: string;
  generated_file: string | null;
  blocks_release: boolean;
}

export interface DocumentChecklistSummary {
  total: number;
  completed: number;
  pending: number;
  rejected: number;
  not_applicable: number;
  completion_percentage: number;
}

export interface DocumentAttachmentRecord {
  id: UUID;
  batch: UUID;
  document_code: string;
  file: string;
  original_name: string;
  description: string;
  uploaded_by: UUID | null;
  created_at: string;
}

export interface BatchReleaseRecord {
  id: UUID;
  batch: UUID;
  released_quantity: string;
  retained_quantity: string;
  rejected_quantity: string;
  unit: UUID | null;
  warehouse_location: UUID | null;
  released_at: string | null;
  condition: 'RELEASED' | 'CONDITIONAL' | 'REJECTED';
  released_by_quality: UUID | null;
  quality_signature: string | null;
  approved_by_technical_director: UUID | null;
  technical_director_signature: string | null;
  observations: string;
  release_document: string | null;
}

export interface BatchExportRecord {
  id: UUID;
  batch: UUID;
  kind: 'FULL_DOSSIER' | 'SINGLE_DOCUMENT';
  document_code: string;
  include_attachments: boolean;
  include_photos: boolean;
  include_not_applicable: boolean;
  file: string;
  generated_by: UUID | null;
  created_at: string;
}

// ── Lote ───────────────────────────────────────────────────────────────────

export async function getBatches(): Promise<BatchRecord[]> {
  return getPage<BatchRecord>(`${BASE}/batches/`);
}

export async function getBatch(id: string): Promise<BatchRecord> {
  const { data } = await api.get<BatchRecord>(`${BASE}/batches/${id}/`);
  return data as BatchRecord;
}

export async function createBatch(input: {
  production_order: string;
  area?: string;
  production_line?: string;
  production_manager?: string | null;
  quality_manager?: string | null;
  scheduled_at?: string | null;
  notes?: string;
}): Promise<BatchRecord> {
  const { data } = await api.post<BatchRecord>(`${BASE}/batches/`, input);
  return data as BatchRecord;
}

export async function startBatch(id: string): Promise<BatchRecord> {
  const { data } = await api.post<BatchRecord>(`${BASE}/batches/${id}/start/`, {});
  return data as BatchRecord;
}

export async function changeBatchStatus(id: string, input: { status: BatchStatus; reason?: string; observation?: string }): Promise<BatchRecord> {
  const { data } = await api.post<BatchRecord>(`${BASE}/batches/${id}/change-status/`, input);
  return data as BatchRecord;
}

export async function exportBatchDossier(
  id: string,
  batchCode: string,
  options: { includeAttachments?: boolean; includePhotos?: boolean; includeNotApplicable?: boolean } = {},
): Promise<void> {
  await downloadBlob(`${BASE}/batches/${id}/export-dossier/`, `expediente-${batchCode}.pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      include_attachments: options.includeAttachments ?? true,
      include_photos: options.includePhotos ?? true,
      include_not_applicable: options.includeNotApplicable ?? false,
    }),
  });
}

export async function getBatchExports(id: string): Promise<BatchExportRecord[]> {
  const { data } = await api.get<BatchExportRecord[]>(`${BASE}/batches/${id}/exports/`);
  return data ?? [];
}

// ── Inventario de materias primas ────────────────────────────────────────────

export async function getRawMaterialBatches(): Promise<RawMaterialBatchRecord[]> {
  return getPage<RawMaterialBatchRecord>(`${BASE}/raw-material-batches/`);
}

export async function createRawMaterialBatch(input: {
  item: string;
  supplier_batch_code: string;
  received_at?: string | null;
  expires_at?: string | null;
  analysis_number?: string;
  quality_status?: string;
  supplier?: string | null;
  notes?: string;
}): Promise<RawMaterialBatchRecord> {
  const { data } = await api.post<RawMaterialBatchRecord>(`${BASE}/raw-material-batches/`, input);
  return data as RawMaterialBatchRecord;
}

export async function getItemStocks(): Promise<ItemStockRecord[]> {
  return getPage<ItemStockRecord>(`${BASE}/item-stocks/`);
}

// ── Dispensación ──────────────────────────────────────────────────────────────

export async function getDispensingOrders(): Promise<DispensingOrderRecord[]> {
  return getPage<DispensingOrderRecord>(`${BASE}/dispensing-orders/`);
}

export async function getDispensingOrderByBatch(batchId: string): Promise<DispensingOrderRecord | null> {
  const { data } = await api.get<PaginatedResponse<DispensingOrderRecord>>(`${BASE}/dispensing-orders/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

export async function weighDispensingLine(id: string, input: { gross_weight: number; tare: number; container?: string }): Promise<DispensingLineRecord> {
  const { data } = await api.post<DispensingLineRecord>(`${BASE}/dispensing-lines/${id}/weigh/`, input);
  return data as DispensingLineRecord;
}

export async function verifyDispensingLine(id: string): Promise<DispensingLineRecord> {
  const { data } = await api.post<DispensingLineRecord>(`${BASE}/dispensing-lines/${id}/verify/`, {});
  return data as DispensingLineRecord;
}

export async function closeDispensingOrder(id: string, location: string): Promise<DispensingOrderRecord> {
  const { data } = await api.post<DispensingOrderRecord>(`${BASE}/dispensing-orders/${id}/close/`, { location });
  return data as DispensingOrderRecord;
}

export async function exportDispensingOrder(id: string, batchCode: string): Promise<void> {
  await downloadBlob(`${BASE}/dispensing-orders/${id}/export/`, `orden-dispensacion-${batchCode}.pdf`);
}

// ── Instrucciones de fabricación ─────────────────────────────────────────────

export async function getManufacturingStepExecutions(batchId: string): Promise<ManufacturingStepExecutionRecord[]> {
  return getPage<ManufacturingStepExecutionRecord>(`${BASE}/manufacturing-step-executions/?batch=${batchId}`);
}

// ── Despeje de línea y limpieza ──────────────────────────────────────────────

export async function getLineClearances(batchId: string): Promise<LineClearanceRecord[]> {
  return getPage<LineClearanceRecord>(`${BASE}/line-clearances/?batch=${batchId}`);
}

export async function approveLineClearance(id: string): Promise<LineClearanceRecord> {
  const { data } = await api.post<LineClearanceRecord>(`${BASE}/line-clearances/${id}/approve/`, {});
  return data as LineClearanceRecord;
}

export async function rejectLineClearance(id: string): Promise<LineClearanceRecord> {
  const { data } = await api.post<LineClearanceRecord>(`${BASE}/line-clearances/${id}/reject/`, {});
  return data as LineClearanceRecord;
}

export async function exportLineClearance(id: string, batchCode: string): Promise<void> {
  await downloadBlob(`${BASE}/line-clearances/${id}/export/`, `despeje-linea-${batchCode}.pdf`);
}

export async function getCleaningRecords(batchId: string): Promise<CleaningRecordRecord[]> {
  return getPage<CleaningRecordRecord>(`${BASE}/cleaning-records/?batch=${batchId}`);
}

export async function getLineIdentification(batchId: string): Promise<LineIdentificationRecord | null> {
  const { data } = await api.get<PaginatedResponse<LineIdentificationRecord>>(`${BASE}/line-identifications/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

// ── Control de producción ────────────────────────────────────────────────────

export async function getProductionControl(batchId: string): Promise<ProductionControlRecord | null> {
  const { data } = await api.get<PaginatedResponse<ProductionControlRecord>>(`${BASE}/production-controls/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

// ── Control de llenado ───────────────────────────────────────────────────────

export async function getFillingControl(batchId: string): Promise<FillingControlRecord | null> {
  const { data } = await api.get<PaginatedResponse<FillingControlRecord>>(`${BASE}/filling-controls/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

// ── Control de peso o volumen ────────────────────────────────────────────────

export async function getWeightVolumeControl(batchId: string): Promise<WeightVolumeControlRecord | null> {
  const { data } = await api.get<PaginatedResponse<WeightVolumeControlRecord>>(`${BASE}/weight-volume-controls/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

// ── Control de hermeticidad ───────────────────────────────────────────────────

export async function getSealIntegrityControl(batchId: string): Promise<SealIntegrityControlRecord | null> {
  const { data } = await api.get<PaginatedResponse<SealIntegrityControlRecord>>(`${BASE}/seal-integrity-controls/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

// ── Control de acondicionamiento ─────────────────────────────────────────────

export async function getPackagingControl(batchId: string): Promise<PackagingControlRecord | null> {
  const { data } = await api.get<PaginatedResponse<PackagingControlRecord>>(`${BASE}/packaging-controls/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

// ── Certificado de análisis y microbiología ──────────────────────────────────

export async function getAnalysisCertificate(batchId: string): Promise<AnalysisCertificateRecord | null> {
  const { data } = await api.get<PaginatedResponse<AnalysisCertificateRecord>>(`${BASE}/analysis-certificates/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

export async function exportAnalysisCertificate(id: string, batchCode: string): Promise<void> {
  await downloadBlob(`${BASE}/analysis-certificates/${id}/export/`, `certificado-analisis-${batchCode}.pdf`);
}

export async function getMicrobiologyAnalysis(batchId: string): Promise<MicrobiologyAnalysisRecord | null> {
  const { data } = await api.get<PaginatedResponse<MicrobiologyAnalysisRecord>>(`${BASE}/microbiology-analyses/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

// ── Verificación documental ───────────────────────────────────────────────────

export async function getDocumentChecklist(batchId: string): Promise<DocumentChecklistItemRecord[]> {
  return getPage<DocumentChecklistItemRecord>(`${BASE}/document-checklist-items/?batch=${batchId}`);
}

export async function getDocumentChecklistSummary(batchId: string): Promise<DocumentChecklistSummary> {
  const { data } = await api.get<DocumentChecklistSummary>(`${BASE}/document-checklist-items/summary/?batch=${batchId}`);
  return data as DocumentChecklistSummary;
}

export async function exportDocumentChecklist(batchId: string, batchCode: string): Promise<void> {
  await downloadBlob(`${BASE}/document-checklist-items/export/?batch=${batchId}`, `verificacion-documental-${batchCode}.pdf`);
}

export async function getBatchAttachments(batchId: string): Promise<DocumentAttachmentRecord[]> {
  return getPage<DocumentAttachmentRecord>(`${BASE}/document-attachments/?batch=${batchId}`);
}

export async function uploadBatchAttachment(input: { batch: string; document_code?: string; file: File; description?: string }): Promise<DocumentAttachmentRecord> {
  const formData = new FormData();
  formData.append('batch', input.batch);
  if (input.document_code) formData.append('document_code', input.document_code);
  formData.append('file', input.file);
  formData.append('original_name', input.file.name);
  if (input.description) formData.append('description', input.description);
  const { data } = await api.post<DocumentAttachmentRecord>(`${BASE}/document-attachments/`, formData);
  return data as DocumentAttachmentRecord;
}

// ── Liberación ────────────────────────────────────────────────────────────────

export async function getBatchRelease(batchId: string): Promise<BatchReleaseRecord | null> {
  const { data } = await api.get<PaginatedResponse<BatchReleaseRecord>>(`${BASE}/batch-releases/?batch=${batchId}`);
  return data?.results?.[0] ?? null;
}

export async function releaseBatch(input: {
  batch: string;
  released_quantity: number;
  retained_quantity: number;
  rejected_quantity: number;
  unit?: string | null;
  warehouse_location?: string | null;
  condition: 'RELEASED' | 'CONDITIONAL' | 'REJECTED';
  observations?: string;
  quality_signature?: File | null;
}): Promise<BatchReleaseRecord> {
  const { quality_signature, ...rest } = input;
  const body: FormData | typeof rest = quality_signature
    ? (() => {
        const formData = new FormData();
        Object.entries(rest).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          formData.append(key, String(value));
        });
        formData.append('quality_signature', quality_signature);
        return formData;
      })()
    : rest;
  const { data } = await api.post<BatchReleaseRecord>(`${BASE}/batch-releases/release/`, body);
  return data as BatchReleaseRecord;
}

export async function exportBatchRelease(id: string, batchCode: string): Promise<void> {
  await downloadBlob(`${BASE}/batch-releases/${id}/export/`, `liberacion-${batchCode}.pdf`);
}
