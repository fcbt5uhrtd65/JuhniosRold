import type { BatchRecord } from '../../services/manufacturing.service';
import { CleaningSection } from './manufacturing-clearance';

/* ═══════════════════════════════════════════════════════
   Pestaña "Limpieza de áreas y equipos (Dispensación y Fabricación)".
═══════════════════════════════════════════════════════ */

export function CleaningEarlyTab({ batch }: { batch: BatchRecord }) {
  return <CleaningSection batch={batch} phases={['DISPENSING', 'MANUFACTURING']} groupLabel="Dispensación y Fabricación" />;
}
