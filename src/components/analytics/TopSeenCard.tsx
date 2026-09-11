import { hapticLight } from '../../lib/haptics';
import { movement, type MostSeen } from '../../lib/fleetHistory';
import { VehicleName } from '../shared/VehicleName';
import type { Vehicle } from '../../types';

// The ten cars FG meets most, down to the plate. Ranking and movement are pure and tested
// (lib/fleetHistory `mostSeen` / `movement`); this only draws them.

function MoveChip({ rank, prevRank }: { rank: number; prevRank: number | null }) {
  const m = movement({ rank, prevRank });
  const [text, cls] =
    m.kind === 'new'  ? ['new', 'text-blue-600 dark:text-blue-400'] :
    m.kind === 'same' ? ['=',   'text-gray-400 dark:text-gray-500'] :
    m.kind === 'up'   ? [`▲${m.by}`, 'text-green-700 dark:text-green-400'] :
                        [`▼${m.by}`, 'text-amber-700 dark:text-amber-400'];
  return (
    <span className={`w-9 text-right text-[10px] font-semibold tabular-nums ${cls}`}
      title={prevRank === null ? 'Not seen before last week' : `#${prevRank} a week ago`}>
      {text}
    </span>
  );
}

export function TopSeenCard({ ranking, vehiclesById, since, onOpen }: {
  ranking: MostSeen;
  vehiclesById: ReadonlyMap<string, Vehicle>;
  since: string | null;
  onOpen: (vehicleId: string) => void;
}) {
  if (ranking.rows.length === 0) return null;
  const last = ranking.rows[ranking.rows.length - 1];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top 10 · most seen</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
        Every sighting{since ? ` since ${since}` : ''}. The arrow is the change since a week ago. Cars
        with the same count <b>share a place</b>.
      </p>

      <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
        {ranking.rows.map(r => {
          const v = vehiclesById.get(r.vehicleId);
          return (
            <button
              key={r.vehicleId}
              type="button"
              onClick={() => { hapticLight(); onOpen(r.vehicleId); }}
              className="w-full flex items-center gap-2 py-2 text-left text-[11px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded"
            >
              <span className="w-7 shrink-0 tabular-nums font-semibold text-gray-500 dark:text-gray-400">
                {r.tiedWith > 1 ? `=${r.rank}` : r.rank}
              </span>
              <span className="w-16 shrink-0 font-mono font-semibold text-gray-900 dark:text-gray-100">
                {v?.licensePlate ?? '—'}
              </span>
              <span className="flex-1 min-w-0 truncate text-gray-600 dark:text-gray-300">
                {v ? <VehicleName vehicle={v} /> : ''}
              </span>
              <span className="w-7 shrink-0 font-mono text-gray-400 dark:text-gray-500">{v?.rentalClass ?? ''}</span>
              <span className="w-5 shrink-0 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                {r.sightings}
              </span>
              <MoveChip rank={r.rank} prevRank={r.prevRank} />
            </button>
          );
        })}
      </div>

      {ranking.moreTied > 0 && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
          +{ranking.moreTied} more tied at {last.sightings}. The last places are a toss-up until the counts spread.
        </p>
      )}
    </div>
  );
}
