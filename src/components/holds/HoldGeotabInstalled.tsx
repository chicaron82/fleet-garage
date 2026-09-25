import { useGeotabInstall } from '../../hooks/useGeotabInstall';
import { GEOTAB_HOLD_DESC } from '../../lib/hold-presets';
import type { Hold } from '../../types';

// "📡 Geotab installed <when> · by <who>" on the geotab hold's own card.
//
// ⭐ Aaron, 2026-09-25, on LJF707: *"Geotab got installed for this today. I cleared it off the list.
// The flag just moves to no action needed. I think it should also show that it was installed"*.
// The hold closes as RETURNED, so the card said "Returned", which is true but doesn't say the unit
// went in. `geotab_watchlist` had the date and the person, but the only place that showed them was
// the Identity dropdown (useGeotabInstall, 09-07). Now the hold that asked the question shows the answer.
//
// Renders nothing for any other hold, or while the car is still waiting for its unit.
export function HoldGeotabInstalled({ hold, plate, getName, fmt }: {
  hold: Pick<Hold, 'damageDescription'>;
  plate: string | null | undefined;
  getName: (id: string) => string;
  fmt: (iso: string) => string;
}) {
  const isGeotab = hold.damageDescription === GEOTAB_HOLD_DESC;
  const install = useGeotabInstall(isGeotab ? plate : null);
  if (!isGeotab || !install?.installedAt) return null;
  return (
    <p className="text-xs font-medium text-green-700 dark:text-green-400">
      📡 Geotab installed {fmt(install.installedAt)}
      {install.installedBy ? <> · by {getName(install.installedBy)}</> : null}
    </p>
  );
}
