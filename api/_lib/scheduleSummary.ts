// Pure formatting for the copilot's `lookup_schedule` tool — "who's closing with me
// tonight?". The proxy queries `shifts` (RLS-scoped) + resolves names from
// `profiles`; this shapes the people-per-shift into a human line. No I/O — unit-
// tested without Supabase.

export interface ScheduleGroup {
  shiftType: string; // 'opening' | 'mid' | 'closing' | 'day-off' | 'pto' | 'sick'
  people: string[];
}

const LABELS: Record<string, string> = {
  opening: 'Opening',
  mid: 'Mid',
  closing: 'Closing',
  'day-off': 'Day off',
  pto: 'PTO',
  sick: 'Sick',
};

export function describeShiftType(t: string): string {
  return LABELS[t] ?? t;
}

/**
 * Human summary of who's on which shift for a date. `filterType` narrows to one
 * kind ("who's CLOSING"); omitted lists the working shifts (opening/mid/closing).
 * `dateLabel` is pre-formatted by the caller (e.g. "Jun 26, 2026") to stay pure.
 */
export function formatSchedule(dateLabel: string, groups: ScheduleGroup[], filterType?: string): string {
  const working = new Set(['opening', 'mid', 'closing']);
  const shown = groups
    .filter((g) => g.people.length > 0)
    .filter((g) => (filterType ? g.shiftType === filterType : working.has(g.shiftType)));

  if (shown.length === 0) {
    return filterType
      ? `No one is on the ${describeShiftType(filterType).toLowerCase()} shift on ${dateLabel}.`
      : `No one is scheduled on ${dateLabel}.`;
  }

  // Closing first, then opening, then the rest — the order a VSA cares about.
  const rank = (t: string) => (t === 'closing' ? 0 : t === 'opening' ? 1 : 2);
  const parts = shown
    .slice()
    .sort((a, b) => rank(a.shiftType) - rank(b.shiftType))
    .map((g) => `${describeShiftType(g.shiftType)}: ${g.people.join(', ')}`);
  return `${dateLabel} — ${parts.join('. ')}.`;
}
