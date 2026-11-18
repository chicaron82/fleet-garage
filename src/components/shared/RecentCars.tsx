import type { VehicleSearchResult } from '../../lib/ev-detection';
import { LookupRow } from './LookupRow';

/**
 * The "Recent" list under a search box, drawn with Find a car's own row (LookupRow) so all of them look the same.
 * In flow, never floating: a host inside a scroll box would clip an absolute list (VehicleLookup's `inlineResults`).
 * See useRecentCarsBox for when it shows and why.
 */
export function RecentCars({ recents, onChoose }: { recents: readonly VehicleSearchResult[]; onChoose: (v: VehicleSearchResult) => void }) {
  if (recents.length === 0) return null;
  return (
    <div className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg" data-testid="recent-cars">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Recent</p>
      <ul>
        {recents.map(v => (
          <li key={`${v.license_plate}·${v.unit_number ?? ''}`}><LookupRow v={v} query="" onChoose={onChoose} active={false} /></li>
        ))}
      </ul>
    </div>
  );
}
