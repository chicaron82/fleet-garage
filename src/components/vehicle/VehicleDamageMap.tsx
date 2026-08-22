// What is wrong with THIS CAR, right now, and where — sitting above the hold history as a
// persistent reference rather than something you have to open a record to see.
//
// ⭐ WHY IT EXISTS, in Aaron's words (2026-08-22, from the lot): "an at a glance reference guide
// telling me damage exists on that part of the car... it should be marked on the manual inspection
// slip. if it's been repaired then it's clear." The moment it earns its place is when he is standing
// at the vehicle with paper Vehicle Inspection #9000501 in hand, deciding what to circle. Per-hold
// tagging is data entry; this is the thing that makes the tagging pay, on every car, every time.
//
// Read-only on purpose. Tagging belongs to a hold — a panel means nothing without the record that
// explains it — so this never accepts a tap. It reports.
import { vehicleDamageZones, zoneLabel } from '../../lib/damageZones';
import { DamageZoneMap } from '../holds/DamageZoneMap';
import type { Hold } from '../../types';

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900';

export function VehicleDamageMap({ holds }: { holds: readonly Hold[] }) {
  const { zones, lastFlaggedAt } = vehicleDamageZones(holds);

  return (
    <section className={`${CARD} px-4 py-3`} data-testid="vehicle-damage-map">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Damage on this car
        </p>
        {lastFlaggedAt && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
            last flagged {lastFlaggedAt.slice(0, 10)}
          </p>
        )}
      </div>

      {zones.length === 0 ? (
        // Not an empty state — a claim. "Nothing recorded" is what he reads before writing the slip,
        // and it has to be distinguishable from "we never looked", which is what the holds below say.
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 italic">
          No damage zones recorded on the standing holds.
        </p>
      ) : (
        <>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {zones.map(id => (
              <span key={id}
                    className="rounded-full border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                {zoneLabel(id)}
              </span>
            ))}
          </div>
          <div className="mt-2 max-w-sm mx-auto">
            <DamageZoneMap selected={zones} onToggle={() => {}} disabled />
          </div>
        </>
      )}
    </section>
  );
}
