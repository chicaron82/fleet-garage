import { useState } from 'react';
import { DamageZoneMap } from './DamageZoneMap';
import { initialZoneView, initialThirdRow, countOnView, type ZoneView } from '../../lib/zoneView';
import { useRoutedProp } from '../../hooks/useRoutedProp';

// The "where" question, with two views — Aaron, 2026-08-26.
//
// ONE question, not two flows: a car can be dented AND missing a headrest, both tags land in the
// same array on the same hold, and the operator switches views rather than deciding up front which
// kind of problem he is about to record.
//
// ⚠️ THE VIEW FOLLOWS THE DATA. A hold whose only tag is `seat-second-passenger` must not open on
// the exterior map showing an empty car — that reads as "nothing recorded" and would re-create the
// recorded-but-not-knowable defect inside the feature built to fix it. See lib/zoneView.
export function ZoneMapPicker({ selected, onToggle, disabled = false, candidates = [], focused = null, label }: {
  selected: readonly string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  candidates?: readonly string[];
  focused?: string | null;
  label?: string;
}) {
  const [view, setView] = useState<ZoneView>(() => initialZoneView(selected));
  const [hasThirdRow, setHasThirdRow] = useState(() => initialThirdRow(selected));

  // ⚠️ Re-seed when the SUBJECT changes, not on every render. `useState` alone seeds once at mount,
  // so moving from a dented car to a headrest-only one would keep showing the exterior — the same
  // frozen-initial-state bug fixed in the opening-duties signal earlier today, one component over.
  const subject = selected.join('|');
  useRoutedProp(subject, () => {
    setView(initialZoneView(selected));
    setHasThirdRow(initialThirdRow(selected));
  });

  const otherView: ZoneView = view === 'exterior' ? 'interior' : 'exterior';
  const otherCount = countOnView(selected, otherView);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {(['exterior', 'interior'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`h-9 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
              view === v
                ? 'bg-fg-yellow text-black'
                : 'border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400'
            }`}
          >
            {v === 'exterior' ? 'Exterior' : 'Interior'}
            {/* ⚠️ Says how many tags are on the OTHER map. Without it, switching views is a blind
                guess about whether anything is over there — and a tag you don't know exists is the
                same as a tag that isn't rendered. */}
            {v !== view && otherCount > 0 && (
              <span className="ml-1.5 font-bold">· {otherCount}</span>
            )}
          </button>
        ))}

        {view === 'interior' && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
            {/* ⚠️ Its own accessible name. Without it this control and the third-row ZONE are
                both checkboxes announced as "3rd row" — a real ambiguity for a screen reader, and
                the thing a component test tripped over first. "Show" names the action; the zone
                keeps the place. */}
            <input
              type="checkbox"
              aria-label="Show third-row seating"
              checked={hasThirdRow}
              onChange={e => setHasThirdRow(e.target.checked)}
              className="h-4 w-4 accent-fg-yellow cursor-pointer"
            />
            {/* Aaron: "toggle if exists." Reveals the bench; stores nothing. On the classes that have
                one it is normally UP — the seating is the upsell — so this is about whether the CAR
                has a third row, not whether it happens to be folded today. */}
            3rd row
          </label>
        )}
      </div>

      <DamageZoneMap
        selected={selected} onToggle={onToggle} disabled={disabled}
        candidates={candidates} focused={focused} label={label}
        view={view} hasThirdRow={hasThirdRow}
      />
    </div>
  );
}
