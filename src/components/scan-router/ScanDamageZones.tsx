// WHERE the damage is, on the car in his hand — the other half of what the scan sheet tells him.
//
// The sheet has said WHAT since 2026-08-16 ("🔧 Damage · Windshield chip · flagged 3 days ago"). The
// panel lived one navigation step away on the vehicle screen, which is a step he takes one-handed
// while holding a key tag and a paper slip. Aaron, from the floor 2026-08-24: "showing me the damage
// map if there are things marked."
//
// ⭐ THIS IS THE MOMENT THE TAGGING WAS FOR. He backfilled hundreds of holds so "where is it" would
// be answerable at a glance, and the glance that matters is at the car with Vehicle Inspection
// #9000501 in hand, deciding what to circle. The scan is how he identifies the car — so the map
// belongs here, not one screen away.
//
// ⚠️ SILENT WHEN THERE IS NOTHING TO SAY, which is his own gate and the right one: most scans are
// clear cars, and a blank diagram on every one of them trains him to scroll past the sheet. Nothing
// renders unless a panel is actually recorded.
//
// Compact on purpose — "Start trip" and "Scan another" must stay reachable without scrolling, and
// they are what the sheet is for. The chips carry the location in one line; the map is the glance.
import { vehicleDamageZones, zoneLabel } from '../../lib/damageZones';
import { DamageZoneMap } from '../holds/DamageZoneMap';
import type { Hold } from '../../types';

export function ScanDamageZones({ holds, vehicleId }: { holds: readonly Hold[]; vehicleId: string }) {
  const { zones } = vehicleDamageZones(holds.filter(h => h.vehicleId === vehicleId));
  if (zones.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-red-200 bg-red-50/60 px-2.5 py-2 dark:border-red-900/60 dark:bg-red-950/25"
         data-testid="scan-damage-zones">
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-red-700/70 dark:text-red-300/70">
          Damage on this car
        </span>
        {zones.map(id => (
          <span key={id}
                className="rounded-full border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {zoneLabel(id)}
          </span>
        ))}
      </div>
      {/* Capped narrow rather than full-width: the diagram only has to be readable, and every pixel
          it takes is a pixel between him and the action he opened the sheet to tap. */}
      <div className="mx-auto mt-1.5 max-w-[13rem]">
        <DamageZoneMap selected={zones} onToggle={() => {}} disabled />
      </div>
    </div>
  );
}
