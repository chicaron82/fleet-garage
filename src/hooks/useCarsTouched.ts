// "What did I do on my shift?" — the numerator for the cars-touched throughput basis.
//
// ⭐ Aaron, 2026-09-11: *"its what i touched during my shift. my last logged was 14:26."* The change
// log agreed to the minute — `vehicle_changes` gave 54 distinct at 14:26 where sightings gave 51 at
// 14:25, and his own rule is that viewing never counts, only changing. So "touched" was always the
// change table, and the data said so independently.
//
// ⚠️⚠️ THE WINDOW COMES FROM `shiftWindowBounds`, NOT FROM A SECOND COPY OF THE PRECEDENCE.
// actual → planned → nothing is one rule, and `shift-metrics` owns it. A hook that re-derived it
// would let the shift-scoped COUNT and the shift-scoped RATE disagree about when the shift was —
// the drift that file's header calls "the 540/hr lesson, locked".
//
// ⚠️ The query is WINDOWED and that is what makes it cheap. Paging `vehicle_changes` unbounded
// gateway-times-out (found the hard way, 2026-09-13); bounded by `changed_at` it rides the
// `vehicle_changes_at_idx` btree — 88 rows in 553 ms for a real opening shift. Never fetch this
// table without a time bound.
//
// ⚠️ Fetches a WIDER span than the window on purpose — the whole business day — so `countTouched`
// can report what he did OUTSIDE his shift rather than never seeing it. That is his asterisk:
// *"whatever we enter in for odo from tonight's gas sheets would have an asterisk added after (or in
// some cases maybe before) my shift."* Dropping those rows at the query would make the asterisk
// unknowable.
import { useEffect, useState } from 'react';
import { shiftWindowBounds } from '../lib/shift-metrics';
import { fetchCarsTouched } from '../lib/carsTouchedQuery';
import type { TouchedCount } from '../lib/throughputBasis';
import { shiftDayStartISO } from '../lib/shiftDay';

/** Null until it has loaded, or when there is no shift to scope to — never a misleading zero. */
export function useCarsTouched(args: {
  userId: string | undefined;
  /** Business date, YYYY-MM-DD. */
  date: string;
  shift: {
    startTime?: string | null;
    endTime?: string | null;
    actualStartTime?: string | null;
    actualEndTime?: string | null;
  } | null;
  /** Skip the query entirely when the other basis is selected — this is not free. */
  enabled: boolean;
}): TouchedCount | null {
  const { userId, date, shift, enabled } = args;
  /** ⭐ KEYED BY THE WINDOW IT WAS COUNTED FOR, so a result can never outlive its question. Change
   *  the date or the clock-in time and the stored key stops matching — the hook returns null again
   *  rather than showing yesterday's 54 against today's shift. It also means the disabled path needs
   *  no `setCount(null)` in the effect body, which is what `set-state-in-effect` was rightly
   *  objecting to: the guard is DERIVED, not stored. */
  const [result, setResult] = useState<{ key: string; count: TouchedCount } | null>(null);

  const bounds = shiftWindowBounds({
    date,
    actualStart: shift?.actualStartTime,
    actualEnd:   shift?.actualEndTime,
    plannedStart: shift?.startTime,
    plannedEnd:   shift?.endTime,
  });
  const startMs = bounds?.startMs ?? null;
  const endMs = bounds?.endMs ?? null;

  const key = `${userId ?? ''}|${date}|${startMs ?? ''}|${endMs ?? ''}`;

  useEffect(() => {
    if (!enabled || !userId || startMs == null || endMs == null) return;
    let cancelled = false;
    const dayStart = shiftDayStartISO(date);
    // The day's far edge: the business day runs to the next day's 04:00 cutover.
    const dayEnd = new Date(Date.parse(dayStart) + 28 * 3_600_000).toISOString();

    void fetchCarsTouched({
      userId, dayStartISO: dayStart, dayEndISO: dayEnd, windowStartMs: startMs, windowEndMs: endMs,
    }).then(count => { if (!cancelled && count) setResult({ key, count }); });
    return () => { cancelled = true; };
  }, [enabled, userId, date, startMs, endMs, key]);

  return result && result.key === key ? result.count : null;
}
