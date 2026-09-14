// Work days — the weekdays a person can be scheduled to WORK, when that is a rule (migration 144).
//
// Aaron, 2026-09-14: *"Grant can only work Tues and Thurs. if scheduled any other day, its an error."*
//
// ⭐ ONE RULE, EVERY WRITE PATH. A shift reaches `shifts` by photo import, Fill range, Repeat week, a
// hand-added shift or a direct import — so the check is a pure function both surfaces call: the import
// preview (before the write) and the Schedule screen (reading what is stored).
//
// ⚠️ WARNS, NEVER REFUSES. The posted sheet is what was posted; refusing the write would leave FG
// holding less than the paper. Same stance as `auditWarnings`.
//
// Pure: no DB, no React.

/** ISO weekday, 1 = Monday … 7 = Sunday — the same numbering the column stores. */
export function isoWeekday(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday; UTC so no timezone can shift the day
  return js === 0 ? 7 : js;
}

/** A shift that has someone actually working. PTO, sick and day-off are the opposite of that — a
 *  VAC row on a day he can't work is not a conflict (Grant's Sep 14–20 week is exactly that). */
export function isWorkingType(shiftType: string): boolean {
  return shiftType === 'opening' || shiftType === 'mid' || shiftType === 'closing';
}

/** Does this shift break the person's work days? Null / empty work days = any day, never a conflict. */
export function isWorkDayConflict(
  workDays: readonly number[] | null | undefined,
  dateISO: string,
  shiftType: string,
): boolean {
  if (!workDays || workDays.length === 0 || !isWorkingType(shiftType)) return false;
  return !workDays.includes(isoWeekday(dateISO));
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Tue and Thu" · "Mon, Wed and Fri" — in week order, whatever order the column holds. */
export function describeWorkDays(workDays: readonly number[]): string {
  const names = [...new Set(workDays)].sort((a, b) => a - b).map(d => DAY_NAMES[d - 1]).filter(Boolean);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface WorkDayConflict {
  name: string;
  date: string;
  workDays: readonly number[];
}

/** "Grant — Wed Sep 16 · works Tue and Thu only" */
export function describeConflict(c: WorkDayConflict): string {
  const [y, m, d] = c.date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${c.name} — ${day} · works ${describeWorkDays(c.workDays)} only`;
}

interface ShiftLike { userId: string; date: string; shiftType: string }
interface PersonLike { name: string; workDays?: readonly number[] | null }

/**
 * Every stored shift, from `fromISO` on, that puts someone on a day they cannot work.
 *
 * ⚠️ FROM TODAY, NOT FROM THE START OF THE LOADED RANGE. A past conflict has already happened — he
 * cannot fix a shift that is over, and a banner that never clears is a banner he learns to ignore.
 */
export function findWorkDayConflicts(
  shifts: readonly ShiftLike[],
  people: ReadonlyMap<string, PersonLike>,
  fromISO: string,
): WorkDayConflict[] {
  const out: WorkDayConflict[] = [];
  for (const s of shifts) {
    if (s.date < fromISO) continue;
    const p = people.get(s.userId);
    if (!p?.workDays || !isWorkDayConflict(p.workDays, s.date, s.shiftType)) continue;
    out.push({ name: p.name, date: s.date, workDays: p.workDays });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/**
 * The same rule over a PARSED sheet, before anything is written — the photo import preview.
 *
 * ⭐ Returns the cells as well as the sentences: the grid marks the exact cell (`"row-cell"`, the key
 * the modal already uses for its overrides), and the notice names it in words. Uses the EFFECTIVE type
 * of each cell (parse + his taps), so cycling a wrong cell to Off clears the warning as he taps.
 * No `fromISO` here: a conflict on a sheet he is about to write is worth saying whatever its date.
 */
export function findImportWorkDayConflicts(
  rows: readonly { cells: readonly { date: string | null }[] }[],
  assignments: readonly (string | null)[],
  types: readonly (readonly string[])[],
  people: ReadonlyMap<string, PersonLike>,
): { cells: Set<string>; conflicts: WorkDayConflict[] } {
  const cells = new Set<string>();
  const shifts: ShiftLike[] = [];
  rows.forEach((row, ri) => {
    const userId = assignments[ri];
    if (!userId) return;
    row.cells.forEach((c, ci) => {
      const t = types[ri]?.[ci];
      if (!c.date || !t) return;
      if (isWorkDayConflict(people.get(userId)?.workDays, c.date, t)) cells.add(`${ri}-${ci}`);
      shifts.push({ userId, date: c.date, shiftType: t });
    });
  });
  return { cells, conflicts: findWorkDayConflicts(shifts, people, '') };
}
