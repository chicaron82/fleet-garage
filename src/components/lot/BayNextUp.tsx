// Next up: the one car lined up behind the car in the bay. Aaron, 2026-11-02: *"since we generally work with another
// vehicle lined up. what if we entered standby plate for what is going to cleaned next. tapping cleaned, starts the next
// one if one is loaded?"* Every exit pulls it in, on the server, so a hold that closes from the Flag / hold screen does
// too. Ticket: docs/ticket-bay-odo-in-card-and-next-up.md.
//
// • With a car in the bay: a quiet "+ Next up" that opens the search. No keyboard until he asks, it would cover the exits.
// • With the bay empty and a car still loaded (a pull that failed): it says so and offers the Start, never a dead end.
import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useBayStandby } from '../../hooks/useBayStandby';
import { useAuth } from '../../context/AuthContext';
import { useLookupRecents } from '../../hooks/useLookupRecents';
import { hapticMedium } from '../../lib/haptics';
import { initialsOf } from '../../lib/lotLookout';
import { vehicleForPick } from '../../lib/lotBayLog';
import { VehicleLookup } from '../shared/VehicleLookup';

const HEAD = 'text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400';

export function BayNextUp({ inBay, onStart }: {
  /** The car in the bay's plate, or null when the bay is empty. */
  inBay: string | null;
  /** The empty bay's Start for a car still loaded. Resolves to an error, or null. */
  onStart: (vehicleId: string) => Promise<string | null>;
}) {
  const { user } = useAuth();
  const { standby, loaded, load, clear } = useBayStandby(initialsOf(user?.name ?? null) || 'FG');
  const { vehicles, archivedVehicles } = useVehicleHoldContext();
  const { recents, record } = useLookupRecents(true);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!loaded) return null;

  const run = async (write: () => Promise<string | null>) => {
    hapticMedium();
    setBusy(true);
    setErr('');
    const e = await write();
    setBusy(false);
    if (e) setErr(e);
    return !e;
  };
  const problem = err ? <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{err}</p> : null;

  if (standby) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-2 text-left">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className={HEAD}>Next up</p>
            <p className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">{standby.plate}</p>
            {standby.car && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{standby.car}</p>}
          </div>
          <button type="button" disabled={busy} aria-label={`Clear ${standby.plate} from Next up`} onClick={() => void run(clear)}
            className="h-11 w-11 shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer disabled:opacity-40">✕</button>
        </div>
        {inBay ? <p className="text-[11px] text-gray-500 dark:text-gray-400">Comes in when {inBay} leaves.</p> : (
          <button type="button" disabled={busy} onClick={() => void run(() => onStart(standby.vehicle_id))}
            className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3 text-sm font-extrabold text-black cursor-pointer disabled:opacity-40">▶ Start cleaning {standby.plate}</button>
        )}
        {problem}
      </div>
    );
  }

  // The empty bay has its own search for the car going in now.
  if (!inBay) return null;
  if (!picking) {
    return (
      <button type="button" onClick={() => { setPicking(true); setErr(''); }}
        className="w-full h-11 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
        + Next up
      </button>
    );
  }
  const fleet = [...vehicles, ...archivedVehicles];
  return (
    <div className="space-y-2 text-left">
      <div className="flex items-baseline justify-between gap-2">
        <p className={HEAD}>Next up</p>
        <button type="button" onClick={() => setPicking(false)} className="text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">Never mind</button>
      </div>
      {/* He tapped to get here, so the keypad finishes the gesture he started (OdometerCapture's autoFocus note). */}
      <VehicleLookup autoFocus inlineResults recents={recents} busy={busy} placeholder="Plate or unit"
        onPick={c => {
          const found = vehicleForPick(fleet, 'vehicle' in c ? { plate: c.vehicle.license_plate, unit: c.vehicle.unit_number } : c);
          if (!found) { setErr(`${'typed' in c ? c.typed : c.vehicle.license_plate} isn't a car in FG.`); return; }
          void record(found.id);
          void run(() => load(found.id)).then(ok => { if (ok) setPicking(false); });
        }} />
      {problem}
    </div>
  );
}
