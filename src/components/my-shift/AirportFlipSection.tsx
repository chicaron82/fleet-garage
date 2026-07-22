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
import { flipRowLine, flipClassSummary } from '../../lib/airportFlip';
import { checkKeys, keyShortNote } from '../../lib/keyCount';
import { isOnExceptionStatus } from '../../lib/vehicle-status';
import { useGeotabPending } from '../../hooks/useGeotabPending';
import { FuelLevelSelector, FUEL_LABELS } from '../shared/FuelLevelSelector';
import { BatteryLevelSelector } from '../shared/BatteryLevelSelector';
import { EVAssetCheck } from '../movement/EVAssetCheck';
import { toEvStatus } from '../../lib/ev-detection';
import { useUserResolver } from '../../hooks/useUserResolver';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import type { EvAssetStatus, Vehicle } from '../../types';

const INPUT = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';
const onException = (v: Vehicle | null) => !!v && isOnExceptionStatus(v.status);

export function AirportFlipSection() {
  const { user } = useAuth();
  const { vehicles, addVehicle, updateVehicleFields, getHoldsForVehicle, addHold, updateVehicleEVAssets, recordKeyCount, attachKeytagPhoto } = useVehicleHoldContext();
  const flip = useAirportFlip();
  const { getName } = useUserResolver();
  const checkGeotab = useGeotabPending();

  const [capture, setCapture] = useState<{ plate: string; unit: string | null; rentalClass: string; vehicle: Vehicle | null; isTesla: boolean; vehicleId: string | null } | null>(null);
  const [geotabPending, setGeotabPending] = useState(false);
  const [odo, setOdo] = useState('');
  const [fuelLevel, setFuelLevel] = useState<number | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);
  // SEEDED from what the record already believes, then corrected — not blank-until-tapped.
  // Aaron's call (2026-07-21): the flip uses the same EVAssetCheck as trip-start and the EV Assets
  // tab, so one concept has one interaction everywhere. Checked = there, unchecked = missing; the
  // cost is that "didn't look" now reads as "re-affirmed", which is the trade a two-state control
  // makes. Seeding from the record (rather than blank) is what keeps that re-affirmation honest —
  // an untouched card repeats the last known truth instead of inventing one.
  const [cable, setCable] = useState<EvAssetStatus | null>(null);
  const [adapter, setAdapter] = useState<EvAssetStatus | null>(null);
  const [keys, setKeys] = useState<number | null>(null);
  const [damaged, setDamaged] = useState(false);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState('');

  // Diffed against what the car is SUPPOSED to carry, so FG says "a key short" instead of just
  // storing a number. Null keys = not counted; a car with no baseline seeds it from this count.
  const keyCheck = keys !== null ? checkKeys(capture?.vehicle?.keyCount ?? null, keys) : null;

  // Scan a return → resolve + enrich the fleet from the WHOLE read (register new / backfill partial),
  // then open the capture card. New cars / too-partial reads no-op the fleet write; never blocks.
  const onScan = async (read: KeytagRead, photo: string) => {
    const { plate, vehicle } = resolveKeytagScan(read, vehicles);
    if (!plate) { setToast('Could not read that tag — try again.'); return; }
    let registeredId: string | undefined;
    try {
      const nv = newVehicleToRegisterOnScan(read, vehicles);
      if (nv) registeredId = await addVehicle({ unitNumber: nv.unitNumber, licensePlate: nv.plate, make: nv.make, model: nv.model, year: nv.year, color: nv.color, rentalClass: nv.rentalClass ?? null, isTesla: nv.make === 'Tesla', hasMobileCable: null, hasJ1772Adapter: null, status: 'CLEAR' });
      else {
        const bf = backfillFieldsOnScan(read, vehicles);
        if (bf) await updateVehicleFields(bf.vehicleId, bf.applies);
      }
    } catch { /* fleet enrichment is best-effort — the flip capture still proceeds */ }
    // EITHER signal marks it an EV: the fleet record (authoritative for a car on file) OR the tag's
    // class code, which the codex resolves to a make server-side — so a Tesla FG has never seen
    // still gets the charge gauge + asset check on its very first return.
    const isTesla = !!vehicle?.isTesla || read.make === 'Tesla';
    setCapture({
      plate,
      unit: vehicle?.unitNumber ?? read.unitNumber ?? null,
      rentalClass: read.rentalClass ?? '',
      vehicle,
      isTesla,
      vehicleId: vehicle?.id ?? registeredId ?? null,
    });
    // Keep the tag itself on the record — the evidence a misread can be audited against.
    // Best-effort and fire-and-forget: never delays the capture card.
    const scannedVehicleId = vehicle?.id ?? registeredId ?? null;
    if (scannedVehicleId) void attachKeytagPhoto(scannedVehicleId, photo);
    setGeotabPending(await checkGeotab(plate));
    // Seed the asset boxes from the record: last known, or present for a car never assessed
    // (same `?? present` default the EV Assets tab uses — absence of a check isn't a loss).
    setCable(toEvStatus(vehicle?.hasMobileCable) ?? 'present');
    setAdapter(toEvStatus(vehicle?.hasJ1772Adapter) ?? 'present');
    setOdo(''); setFuelLevel(null); setBatteryPct(null); setKeys(null); setDamaged(false); setNotes('');
  };

  const addToList = () => {
    if (!capture) return;
    const level = capture.isTesla
      ? (batteryPct !== null ? `${batteryPct}%` : '')
      : (fuelLevel !== null ? FUEL_LABELS[fuelLevel] : '');
    // A short ring rides the counter copy-out — actionable while the rental is still open.
    const shortNote = keyCheck ? keyShortNote(keyCheck) : '';
    const counterNotes = [notes.trim(), shortNote].filter(Boolean).join(' · ');
    flip.add({ plate: capture.plate, unit: capture.unit, rentalClass: capture.rentalClass, odo, fuel: level, isEv: capture.isTesla, damaged, notes: counterNotes });
    // Latest count is the new truth (and seeds the baseline the first time a car is counted).
    if (keys !== null && capture.vehicleId) void recordKeyCount(capture.vehicleId, keys);
    // The flip IS the check-in that closes the contract — so a missing cable/adapter caught HERE is
    // still chargeable, where the same loss found later in the washbay is just gone. Seeded boxes
    // mean this always writes for a Tesla: a re-affirmation is itself worth recording, since it's
    // what keeps "last checked" current instead of aging out. Best-effort: never blocks the list.
    if (capture.isTesla && capture.vehicleId && cable && adapter) {
      void updateVehicleEVAssets(capture.vehicleId, cable === 'present', adapter === 'present', 'check_in', notes.trim() || undefined);
    }
    setCapture(null);
    setGeotabPending(false);
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
        <KeytagSearchScan onPlate={() => {}} onRead={(read, photo) => void onScan(read, photo)} />
      ) : (
        <div className="rounded-lg border border-fg-yellow/50 bg-yellow-50/40 dark:bg-yellow-900/10 p-3 space-y-2.5">
          <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
            {capture.plate}{capture.unit ? ` · Unit ${capture.unit}` : ''}
            {onException(capture.vehicle) && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">On exception</span>}
          </p>

          {/* Geotab install watchlist — a hold-until-installed condition, surfaced right where the tag lands. */}
          {geotabPending && (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">📡 On the Geotab install list — hold until a unit is installed.</p>
          )}

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

          {/* The gauge mirrors the instrument: a gas dash reads eighths, a Tesla's reads a %. */}
          {capture.isTesla
            ? <BatteryLevelSelector batteryPct={batteryPct} setBatteryPct={setBatteryPct} />
            : <FuelLevelSelector fuelLevel={fuelLevel} setFuelLevel={setFuelLevel} />}

          {/* EV assets — part of the return's condition, same as odo/fuel/damage, because this
              capture closes the contract. The SAME control as trip-start and the EV Assets tab:
              a cable is a cable whichever screen you're standing on. */}
          {capture.isTesla && (
            <>
              <EVAssetCheck
                cableStatus={cable} adapterStatus={adapter}
                onCableChange={setCable} onAdapterChange={setAdapter}
                lastCheck={capture.vehicle?.evLastUpdatedAt ? {
                  cableStatus: toEvStatus(capture.vehicle.hasMobileCable),
                  adapterStatus: toEvStatus(capture.vehicle.hasJ1772Adapter),
                  when: capture.vehicle.evLastUpdatedAt,
                  byName: capture.vehicle.evLastUpdatedBy ? getName(capture.vehicle.evLastUpdatedBy) : 'Unknown',
                } : null}
              />
              {(cable === 'missing' || adapter === 'missing') && (
                <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">Flag it at the counter — chargeable while the contract is still open.</p>
              )}
            </>
          )}
          {/* Keys on the ring — a countable asset like the EV kit, and a smart key is a few hundred
              dollars. Counted HERE because this closes the contract; FG diffs it against what the
              car went out with so a short return is caught while it's still chargeable. */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                🔑 Keys on ring
                {capture.vehicle?.keyCount ? <span className="ml-1.5 normal-case font-normal text-gray-400">went out with {capture.vehicle.keyCount}</span> : null}
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} type="button" onClick={() => setKeys(keys === n ? null : n)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold border transition cursor-pointer ${keys === n ? 'bg-fg-yellow border-fg-yellow text-black' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {keyCheck && keyCheck.short > 0 && (
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">{keyShortNote(keyCheck)} — flag it at the counter while the contract is open.</p>
            )}
            {keyCheck?.seedsBaseline && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">First count for this car — saving {keys} as its baseline.</p>
            )}
          </div>

          <input className={INPUT} placeholder="Notes (e.g. weed smell) — optional" value={notes} onChange={e => setNotes(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={damaged} onChange={e => setDamaged(e.target.checked)} className="w-4 h-4 accent-red-500 cursor-pointer" />
            <span>⚠️ Damaged on return</span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setCapture(null); setGeotabPending(false); }} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">Cancel</button>
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
              {r.rentalClass && (
                <span className="rounded bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-indigo-700 dark:text-indigo-300 shrink-0">{r.rentalClass}</span>
              )}
              <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200">{flipRowLine(r)}</span>
              {!r.sent && <button type="button" aria-label="Remove" onClick={() => flip.remove(r.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 text-xs shrink-0 cursor-pointer">✕</button>}
            </div>
          ))}

          {/* Aaron's own shift tally — what he turned around, by class. Not in the counter
              copy-out (they search by plate). */}
          {(() => {
            const { byClass, unclassed } = flipClassSummary(flip.rows);
            if (byClass.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="font-medium">Turned around:</span>
                {byClass.map(c => (
                  <span key={c.rentalClass} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-semibold text-gray-700 dark:text-gray-300">
                    {c.rentalClass} ×{c.count}
                  </span>
                ))}
                {unclassed > 0 && <span className="text-gray-400 dark:text-gray-500">· {unclassed} unclassed</span>}
              </div>
            );
          })()}
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
