import { useEffect, useRef } from 'react';
import type { VehicleSearchResult } from '../../lib/ev-detection';
import { foldOZero } from '../../lib/plateFold';
import { VehicleName } from './VehicleName';

/**
 * One car in a look-up list: a typed match, or a recent. Moved out of VehicleLookup (2026-11-18) so the Recent list on
 * Fleet, Holds, New Hold and the movement log draws the SAME row Find a car does. One row, so they can never drift apart.
 */
export function LookupRow({ v, query, onChoose, active }: { v: VehicleSearchResult; query: string; onChoose: (v: VehicleSearchResult) => void; active: boolean }) {
  // The arrowed row stays in view as the keys walk past the list's scroll edge.
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView?.({ block: 'nearest' }); }, [active]);
  // ⭐ SAY WHICH KEY MATCHED. FG never resolves on a weaker key without saying so — the rule the
  // scan card already follows with `matchedByUnit`. If the plate does not start with what he typed,
  // the unit is what found this car, and he should see that. (A recent passes an empty query, which
  // every plate starts with, so it never claims a unit match it did not make.)
  // Folded, so OGK487 typed for 0GK487 is a plate match, not a unit one.
  const byUnit = !foldOZero(v.license_plate).startsWith(foldOZero(query));
  return (
    <button ref={ref} type="button" onMouseDown={e => e.preventDefault()}
      onClick={() => onChoose(v)} aria-current={active || undefined} data-active={active || undefined}
      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left cursor-pointer transition ${active ? 'bg-fg-yellow/25 dark:bg-fg-yellow/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
      <span className="flex items-center gap-1.5 font-bold text-sm text-gray-900 dark:text-gray-100">
        {v.license_plate}
        {/* Archived cars stay findable — a typed plate is evidence the archive was wrong
            — but they must never look like a live car with the same plate. */}
        {v.archived_at && (
          <span className="rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">📦 archived</span>
        )}
      </span>
      {/* ⚠️⚠️ NEVER HAND-ASSEMBLE THE NAME. Interpolating the year, make and model
          renders perfectly and silently drops the powertrain badge — which is how a
          hybrid Civic read identically to a petrol one on three screens at once. FG's
          architecture test caught exactly this line, and `is_hybrid`/`is_tesla` are in
          the search result FOR this.
          ⭐ It also caught the first version of THIS COMMENT, which quoted the banned
          shape verbatim. The detector reads raw source, so writing the anti-pattern
          down is writing it — and rewording is cheaper than an allowlist, which is
          where a real identity line would eventually hide. */}
      <span className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
        {byUnit && v.unit_number ? `unit ${v.unit_number} · ` : ''}
        <VehicleName vehicle={{ year: v.year, make: v.make, model: v.model, isHybrid: v.is_hybrid, isTesla: v.is_tesla }} />
      </span>
    </button>
  );
}
