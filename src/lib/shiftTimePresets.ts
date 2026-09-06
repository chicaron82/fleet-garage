import type { ShiftType } from '../types';

/**
 * The times he ACTUALLY works, ranked — instead of one hardcoded guess per type.
 *
 * ⭐ `shiftDefaults.ts` pins `mid` at 10:30–19:00. That is a real shift (40 rows, 5 people) and it
 * is also only one of FIFTEEN mids on the books. When the sheet said 09:30–18:00 he picked "Mid",
 * FG filled 10:30–19:00, and he had to hand-edit both fields — which is what prompted this
 * (2026-09-05: *"add a second mid option in the preset so i don't have to manually adjust"*).
 *
 * ⭐⭐ Pure MSG: FG already stores every start/end ever scheduled and how often. Nothing new is
 * collected. A hardcoded second mid would be wrong again the next time the branch reshuffles;
 * a ranking re-sorts itself.
 */

export interface ShiftTimeRow {
  shiftType: string;
  start: string;   // 'HH:MM'
  end: string;     // 'HH:MM'
}

export interface TimePreset {
  start: string;
  end: string;
  /** How many times this exact window has been scheduled — the ranking key, and shown to him. */
  count: number;
}

/** Below this, a window is somebody's one-off and would be noise in a chip row. */
const MIN_USES = 3;
/** More than this and he is scanning rather than picking. */
const MAX_CHIPS = 4;

/**
 * Rank the distinct windows for one shift type, most-scheduled first.
 *
 * ⚠️ Rows with a missing start or end are dropped, not defaulted — a day-off/pto row has no window
 * and inventing one would put a phantom chip in the list.
 */
export function rankTimePresets(
  rows: readonly ShiftTimeRow[],
  type: ShiftType,
  opts: { minUses?: number; max?: number } = {},
): TimePreset[] {
  const minUses = opts.minUses ?? MIN_USES;
  const max = opts.max ?? MAX_CHIPS;
  const tally = new Map<string, TimePreset>();

  for (const r of rows) {
    if (r.shiftType !== type) continue;
    if (!r.start || !r.end) continue;
    const key = `${r.start}-${r.end}`;
    const hit = tally.get(key);
    if (hit) hit.count += 1;
    else tally.set(key, { start: r.start, end: r.end, count: 1 });
  }

  return [...tally.values()]
    .filter(p => p.count >= minUses)
    // Ties break on start time so the row is stable between renders rather than
    // reordering under his thumb when two windows draw level.
    .sort((a, b) => b.count - a.count || a.start.localeCompare(b.start))
    .slice(0, max);
}

/** True when the chips would tell him nothing he isn't already looking at. */
export function presetsWorthShowing(presets: readonly TimePreset[], current: { start: string; end: string }): boolean {
  if (presets.length < 2) return false;
  return presets.some(p => p.start !== current.start || p.end !== current.end);
}
