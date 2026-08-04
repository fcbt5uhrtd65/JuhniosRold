import type { BatchRecord } from '../../services/manufacturing.service';
import { ClearanceSection } from './manufacturing-clearance';

/* ═══════════════════════════════════════════════════════
   Pestaña "Despeje de línea (Llenado y Acondicionamiento)".
═══════════════════════════════════════════════════════ */

export function ClearanceLateTab({ batch }: { batch: BatchRecord }) {
  return <ClearanceSection batch={batch} phases={['FILLING', 'PACKAGING']} groupLabel="Llenado y Acondicionamiento" />;
}
