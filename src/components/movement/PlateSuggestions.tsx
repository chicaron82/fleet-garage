import { VehicleName } from '../shared/VehicleName';
import type { VehicleSearchResult } from '../../lib/ev-detection';

// The plate typeahead's dropdown — the matches, AND the line that says the search itself failed.
//
// ⚠️⚠️ WHY IT EXISTS (2026-09-29, pass two on `be4ab46`). `searchVehicles` returns `failed` and its own
// return type states the contract — *"The caller must SAY so, never render silence."* It had three
// consumers and only Find a car honoured it; both trip typeaheads destructured `matches` alone, so a
// dead network rendered exactly like "no such plate": an empty dropdown that never opened.
// ⭐ The two dropdowns were byte-identical apart from one `top-` offset, so the fix is ONE surface
// both forms render rather than the same patch applied twice — a third typeahead cannot now be added
// that forgets, because there is nothing left to forget. docs/September/ticket-lookup-goes-quiet.md
//
// ⚠️ The failure line says what he can DO. These fields have no "Look up" button to retry (Find a car
// does, and says so instead), and both forms start a trip on a typed plate alone — `canStart` reads
// `draft.plate`, nothing requires a picked suggestion — so typing it out in full genuinely works.

interface Props {
  suggestions: VehicleSearchResult[];
  /** The dropdown is showing at all (the field has focus / a live query). */
  open: boolean;
  /** The search request itself failed — network down, or an error from the DB. */
  failed: boolean;
  onPick: (v: VehicleSearchResult) => void;
  /** Where the dropdown hangs below its own field: the two forms differ by 2px. */
  topClass: string;
}

const PANEL = 'absolute left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50';

export function PlateSuggestions({ suggestions, open, failed, onPick, topClass }: Props) {
  if (!open) return null;

  // ⚠️ Failure OUTRANKS a stale list: the matches still in state are from an older query, and showing
  // them under a dead search would be the silence this component exists to end, wearing older data.
  if (failed) {
    return (
      <div className={`${PANEL} ${topClass}`}>
        <p role="alert" className="px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          Couldn&apos;t search just now — type the full plate to continue.
        </p>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className={`${PANEL} ${topClass}`}>
      {suggestions.map(v => (
        <button
          key={`${v.license_plate}-${v.unit_number ?? ''}`}
          type="button"
          onClick={() => onPick(v)}
          className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0 flex justify-between items-center cursor-pointer"
        >
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{v.license_plate}</span>
          <VehicleName vehicle={{ year: v.year, make: v.make, model: v.model, isHybrid: v.is_hybrid, isTesla: v.is_tesla }}
                       className="text-xs text-gray-500 dark:text-gray-400" />
        </button>
      ))}
    </div>
  );
}
