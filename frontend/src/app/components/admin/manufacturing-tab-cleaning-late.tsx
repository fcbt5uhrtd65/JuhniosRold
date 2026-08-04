import type { BatchRecord } from '../../services/manufacturing.service';
import { CleaningSection } from './manufacturing-clearance';

/* ═══════════════════════════════════════════════════════
   Pestaña "Limpieza de áreas y equipos (Llenado y Acondicionamiento)".
═══════════════════════════════════════════════════════ */

export function CleaningLateTab({ batch }: { batch: BatchRecord }) {
  return <CleaningSection batch={batch} phases={['FILLING', 'PACKAGING']} groupLabel="Llenado y Acondicionamiento" />;
}
