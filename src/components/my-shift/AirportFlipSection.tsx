// Airport Flip — the no-HIR return loop (see lib/airportFlip + useAirportFlip). Scan a return's
// key tag; FG resolves it, quietly registers/backfills the fleet from the full read, and if the
// car went out ON EXCEPTION opens the photo-comparison re-hold right there (the same
// HoldContextPanel the Holds screen uses) so the old-vs-new call is made while the tag's in hand,
// not hours later when it may be recirculating. Capture odo + fuel + damaged, add to the shift
// list, and copy a minimal plate-keyed block for the counter. Thin: resolve + route; the fleet
// writes and the re-hold machinery keep their own homes.
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useAirportFlip } from '../../hooks/useAirportFlip';
import { KeytagSearchScan } from '../holds/KeytagSearchScan';
import { HoldContextPanel } from '../holds/HoldContextPanel';
import { resolveKeytagScan, newVehicleToRegisterOnScan, backfillFieldsOnScan } from '../../lib/resolveKeytagScan';
import { flipRowLine } from '../../lib/airportFlip';
import { FuelLevelSelector, FUEL_LABELS } from '../shared/FuelLevelSelector';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import type { Vehicle } from '../../types';

const INPUT = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';
const onException = (v: Vehicle | null) => v?.status === 'OUT_ON_EXCEPTION' || v?.status === 'AUCTION_SHORT_TERM';

export function AirportFlipSection() {
  const { user } = useAuth();
  const { vehicles, addVehicle, updateVehicleFields, getHoldsForVehicle, addHold } = useVehicleHoldContext();
  const flip = useAirportFlip();

  const [capture, setCapture] = useState<{ plate: string; unit: string | null; vehicle: Vehicle | null } | null>(null);
  const [odo, setOdo] = useState('');
  const [fuelLevel, setFuelLevel] = useState<number | null>(null);
  const [damaged, setDamaged] = useState(false);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState('');

  // Scan a return → resolve + enrich the fleet from the WHOLE read (register new / backfill partial),
  // then open the capture card. New cars / too-partial reads no-op the fleet write; never blocks.
  const onScan = async (read: KeytagRead) => {
    const { plate, vehicle } = resolveKeytagScan(read, vehicles);
    if (!plate) { setToast('Could not read that tag — try again.'); return; }
    try {
      const nv = newVehicleToRegisterOnScan(read, vehicles);
      if (nv) await addVehicle({ unitNumber: nv.unitNumber, licensePlate: nv.plate, make: nv.make, model: nv.model, year: nv.year, color: nv.color, isTesla: nv.make === 'Tesla', hasMobileCable: null, hasJ1772Adapter: null, status: 'CLEAR' });
      else {
        const bf = backfillFieldsOnScan(read, vehicles);
        if (bf) await updateVehicleFields(bf.vehicleId, bf.fills);
      }
    } catch { /* fleet enrichment is best-effort — the flip capture still proceeds */ }
    setCapture({ plate, unit: vehicle?.unitNumber ?? read.unitNumber ?? null, vehicle });
    setOdo(''); setFuelLevel(null); setDamaged(false); setNotes('');
  };

  const addToList = () => {
    if (!capture) return;
    flip.add({ plate: capture.plate, unit: capture.unit, odo, fuel: fuelLevel !== null ? FUEL_LABELS[fuelLevel] : '', damaged, notes });
    setCapture(null);
  };

  const copyForCounter = async () => {
    const text = flip.reportForSend();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      flip.markSent();
      setToast(`Copied ${text.split('\n').length} for the counter · marked sent`);
      setTimeout(() => setToast(''), 3000);
    } catch { setToast('Copy failed — long-press the list to copy manually.'); }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 transition-colors">
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">✈️ Airport Flip</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Scan a return — record odo, fuel, damage for the counter. Clears at end of shift.</p>
      </div>

      {!capture ? (
        <KeytagSearchScan onPlate={() => {}} onRead={(read) => void onScan(read)} />
      ) : (
        <div className="rounded-lg border border-fg-yellow/50 bg-yellow-50/40 dark:bg-yellow-900/10 p-3 space-y-2.5">
          <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
            {capture.plate}{capture.unit ? ` · Unit ${capture.unit}` : ''}
            {onException(capture.vehicle) && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">On exception</span>}
          </p>

          {/* On-exception return → make the re-hold / clear call in place, photos loaded. */}
          {user && capture.vehicle && onException(capture.vehicle) && (
            <HoldContextPanel
              vehicle={capture.vehicle}
              holds={getHoldsForVehicle(capture.vehicle.id)}
              user={user}
              autoExpand
              reHoldContext={capture.vehicle.status === 'AUCTION_SHORT_TERM' ? 'auction' : 'exception'}
              onReHold={async (vehicleId, description, notes, photos, linkedHoldId, holdTypes) => {
                await addHold(vehicleId, description, notes, user.id, photos, holdTypes, undefined, undefined, linkedHoldId);
              }}
            />
          )}

          <input className={INPUT} inputMode="numeric" placeholder="Odometer" value={odo} onChange={e => setOdo(e.target.value)} />
          <FuelLevelSelector fuelLevel={fuelLevel} setFuelLevel={setFuelLevel} />
          <input className={INPUT} placeholder="Notes (e.g. weed smell) — optional" value={notes} onChange={e => setNotes(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={damaged} onChange={e => setDamaged(e.target.checked)} className="w-4 h-4 accent-red-500 cursor-pointer" />
            <span>⚠️ Damaged on return</span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCapture(null)} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">Cancel</button>
            <button type="button" onClick={addToList} className="flex-1 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi py-2 text-xs font-semibold text-black cursor-pointer">Add to list</button>
          </div>
        </div>
      )}

      {toast && <p className="text-xs text-green-700 dark:text-green-400">{toast}</p>}

      {flip.rows.length > 0 && (
        <div className="space-y-1.5">
          {flip.rows.map(r => (
            <div key={r.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${r.sent ? 'border-gray-100 dark:border-gray-800 opacity-55' : 'border-gray-200 dark:border-gray-700'}`}>
              {r.sent ? (
                <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 shrink-0 w-12">✓ Sent</span>
              ) : (
                <input type="checkbox" checked={r.checked} onChange={() => flip.toggleChecked(r.id)} className="w-4 h-4 accent-fg-yellow cursor-pointer shrink-0" />
              )}
              <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200">{flipRowLine(r)}</span>
              {!r.sent && <button type="button" aria-label="Remove" onClick={() => flip.remove(r.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 text-xs shrink-0 cursor-pointer">✕</button>}
            </div>
          ))}
          <button
            type="button"
            onClick={() => void copyForCounter()}
            disabled={flip.checkedUnsentCount === 0}
            className="w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            📋 Copy {flip.checkedUnsentCount} for the counter
          </button>
        </div>
      )}
    </div>
  );
}
