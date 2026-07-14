// Clopen detection across a span of one person's shifts — the "review my uploaded schedule"
// counterpart to the single-day clopen in `scheduleInsights.ts` (which asks "am I in a clopen
// TODAY?"). This asks "where are ALL my clopens in this block?", so Aaron sees them the moment
// he uploads a 4-week schedule, with lead time to get the boss to fix one. Pure + surface-
// agnostic: the import preview uses it now; a persistent My Day / Schedule view could later.

/** A clopen: a closing shift immediately followed by an opening the next calendar day. */
export interface Clopen {
  /** ISO `YYYY-MM-DD` of the closing day. */
  closeDate: string;
  /** ISO `YYYY-MM-DD` of the opening day (always `closeDate` + 1 calendar day). */
  openDate: string;
}

/** One person's shift on a dated day — the minimum clopen detection needs. `type` is a
 *  `ShiftType` or the parser's `ParsedShiftType`; only `closing`/`opening` are read. */
export interface DayShift {
  date: string;
  type: string;
}

/** The next calendar day for an ISO `YYYY-MM-DD`, computed in UTC so month/year rollover
 *  and DST never shift the date. */
function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Every clopen in one person's shifts: a `closing` on day N followed by an `opening` on
 * day N+1 (adjacent calendar days — a day off in between breaks it). The shift TYPE is the
 * signal, no hour threshold. Input need not be sorted; output is in date order. Duplicate
 * dates collapse (last type wins).
 */
export function findClopens(days: DayShift[]): Clopen[] {
  const typeByDate = new Map<string, string>();
  for (const s of days) if (s.date) typeByDate.set(s.date, s.type);

  const out: Clopen[] = [];
  for (const [date, type] of [...typeByDate].sort(([a], [b]) => a.localeCompare(b))) {
    if (type !== 'closing') continue;
    const open = nextDay(date);
    if (typeByDate.get(open) === 'opening') out.push({ closeDate: date, openDate: open });
  }
  return out;
}

/** How a clopen reads on screen — "Jul 15 → Jul 16". Shared so the import banner and the
 *  standing Schedule-screen strip are identical. Dates built from parts so they never
 *  tz-shift. (Display glue, not logic — the detection above is what's tested.) */
export function formatClopen(c: Clopen): string {
  const day = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  };
  return `${day(c.closeDate)} → ${day(c.openDate)}`;
}
