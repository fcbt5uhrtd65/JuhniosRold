/** Daily ordinary hours, after breaks and the existing schedule limit.
 * Excel rule: whole hours plus 0.5 when remaining minutes are at least 25.
 * Keep this in sync with payroll_engine.round_ordinary_minutes.
 */
export function ordinaryHoursFromMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  const safeMinutes = Math.max(0, minutes);
  return Math.floor(safeMinutes / 60) + (safeMinutes % 60 >= 25 ? 0.5 : 0);
}
