import { useEffect, useState } from 'react';
import {
  Beaker,
  Boxes,
  ClipboardCheck,
  DoorOpen,
  Droplets,
  Factory,
  FileText,
  FlaskConical,
  History,
  Package,
  Scale,
  Shield,
  ShieldCheck,
  SprayCan,
  Tag,
  Truck,
  Weight,
} from 'lucide-react';
import { Card, type BadgeColor } from './AdminUI';
import {
  getAreas,
  getProductionLines,
  type AreaRecord,
  type BatchStatus,
  type ProductionLineRecord,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';

/* ═══════════════════════════════════════════════════════
   Tipos, constantes y helpers compartidos entre las pestañas
   del expediente de lote (módulo de manufactura).
═══════════════════════════════════════════════════════ */

// Orden y agrupación calcados del SOP físico real de la empresa (no de las
// fases genéricas del software) — ver referencia en Documentos/Produccion/*.jpeg.
export type BatchTab =
  | 'general'
  | 'documents'
  | 'production_control'
  | 'line_identification'
  | 'cleaning_late'
  | 'clearance_early'
  | 'analysis_certificate'
  | 'packaging_control'
  | 'cleaning_early'
  | 'dispensing'
  | 'manufacturing'
  | 'filling'
  | 'weight_volume'
  | 'clearance_late'
  | 'seal_integrity'
  | 'raw_material_identification'
  | 'final_quality'
  | 'release'
  | 'history';

export type ManufacturingSection = 'planning' | 'batches';

export const MANUFACTURING_SECTIONS: Array<{ id: ManufacturingSection; label: string; icon: typeof FileText }> = [
  { id: 'planning', label: 'Planificación', icon: Factory },
  { id: 'batches', label: 'Expedientes de lote', icon: Package },
];

export const BATCH_TABS: Array<{ id: BatchTab; label: string; icon: typeof FileText }> = [
  { id: 'general', label: 'General', icon: FileText },
  { id: 'documents', label: 'Documentos', icon: ClipboardCheck },
  { id: 'production_control', label: 'Producción', icon: Factory },
  { id: 'line_identification', label: 'Identif. línea', icon: Tag },
  { id: 'cleaning_late', label: 'Limpieza llenado', icon: SprayCan },
  { id: 'clearance_early', label: 'Despeje dispensación', icon: DoorOpen },
  { id: 'analysis_certificate', label: 'Certificado análisis', icon: Beaker },
  { id: 'packaging_control', label: 'Acondicionamiento', icon: Boxes },
  { id: 'cleaning_early', label: 'Limpieza dispensación', icon: SprayCan },
  { id: 'dispensing', label: 'Dispensación', icon: Scale },
  { id: 'manufacturing', label: 'Fabricación', icon: FlaskConical },
  { id: 'filling', label: 'Llenado', icon: Droplets },
  { id: 'weight_volume', label: 'Peso o volumen', icon: Weight },
  { id: 'clearance_late', label: 'Despeje llenado', icon: DoorOpen },
  { id: 'seal_integrity', label: 'Hermeticidad', icon: Shield },
  { id: 'raw_material_identification', label: 'Materia prima', icon: Package },
  { id: 'final_quality', label: 'Calidad final', icon: ShieldCheck },
  { id: 'release', label: 'Liberación', icon: Truck },
  { id: 'history', label: 'Historial', icon: History },
];

export const STATUS_LABELS: Record<BatchStatus, string> = {
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

export const PHASE_LABELS: Record<string, string> = {
  DISPENSING: 'Dispensación',
  MANUFACTURING: 'Fabricación',
  FILLING: 'Llenado',
  PACKAGING: 'Acondicionamiento',
};

export const STATUS_ORDER: BatchStatus[] = [
  'DRAFT', 'SCHEDULED', 'PENDING_DISPENSING', 'DISPENSING', 'DISPENSING_DONE', 'MANUFACTURING',
  'BULK_PENDING_ANALYSIS', 'BULK_APPROVED', 'FILLING', 'PACKAGING', 'FINISHED_QUARANTINE',
  'PENDING_DOCUMENTS', 'PENDING_MICROBIOLOGY', 'RELEASED',
];

// Fase del expediente donde el usuario debe actuar a continuación, según el estado actual del lote.
export const STATUS_TO_CURRENT_TAB: Record<BatchStatus, BatchTab> = {
  DRAFT: 'general',
  SCHEDULED: 'general',
  PENDING_DISPENSING: 'dispensing',
  DISPENSING: 'dispensing',
  DISPENSING_DONE: 'manufacturing',
  MANUFACTURING: 'manufacturing',
  BULK_PENDING_ANALYSIS: 'analysis_certificate',
  BULK_APPROVED: 'filling',
  FILLING: 'filling',
  PACKAGING: 'packaging_control',
  FINISHED_QUARANTINE: 'packaging_control',
  PENDING_DOCUMENTS: 'documents',
  PENDING_MICROBIOLOGY: 'final_quality',
  RELEASED: 'release',
  REJECTED: 'release',
  CLOSED: 'release',
  CANCELLED: 'general',
};

export function batchProgressPercentage(status: BatchStatus): number {
  const index = STATUS_ORDER.indexOf(status);
  return index >= 0 ? Math.round(((index + 1) / STATUS_ORDER.length) * 100) : 100;
}

const TERMINAL_STATUS_LABELS: Partial<Record<BatchStatus, string>> = {
  RELEASED: 'Lote liberado',
  REJECTED: 'Lote rechazado',
  CLOSED: 'Lote cerrado',
  CANCELLED: 'Lote cancelado',
};

// Texto guía ("qué hacer ahora") para tarjetas de lista y encabezados de detalle,
// derivado del mismo mapeo que resalta la pestaña activa (STATUS_TO_CURRENT_TAB).
export function nextStepLabel(status: BatchStatus): string {
  const terminal = TERMINAL_STATUS_LABELS[status];
  if (terminal) return terminal;
  const tab = BATCH_TABS.find((t) => t.id === STATUS_TO_CURRENT_TAB[status]);
  return tab ? `Siguiente: ${tab.label}` : '';
}

export function getMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export function statusBadgeColor(status: BatchStatus): BadgeColor {
  if (status === 'RELEASED') return 'green';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'red';
  if (status === 'CLOSED') return 'blue';
  if (status.startsWith('PENDING') || status === 'FINISHED_QUARANTINE' || status === 'BULK_PENDING_ANALYSIS') return 'yellow';
  return 'purple';
}

export function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CO');
}

export function formatDateTime(value: string | null): string {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-CO');
}

export function getEmployeeName(employee: Employee | undefined): string {
  if (!employee) return 'Sin asignar';
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

export function useAreasAndLines() {
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLineRecord[]>([]);

  useEffect(() => {
    void (async () => {
      const [areasRes, linesRes] = await Promise.allSettled([getAreas(), getProductionLines()]);
      if (areasRes.status === 'fulfilled') setAreas(areasRes.value);
      if (linesRes.status === 'fulfilled') setProductionLines(linesRes.value);
    })();
  }, []);

  return { areas, productionLines };
}

export function BatchProgressBar({ status }: { status: BatchStatus }) {
  const percentage = batchProgressPercentage(status);
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

export function SectionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}
