import type { BatchRecord } from '../../services/manufacturing.service';
import { ClearanceSection } from './manufacturing-clearance';

/* ═══════════════════════════════════════════════════════
   Pestaña "Despeje de línea (Dispensación y Fabricación)".
═══════════════════════════════════════════════════════ */

export function ClearanceEarlyTab({ batch }: { batch: BatchRecord }) {
  return <ClearanceSection batch={batch} phases={['DISPENSING', 'MANUFACTURING']} groupLabel="Dispensación y Fabricación" />;
}
