// Airport Flip — the no-HIR return loop (see lib/airportFlip + useAirportFlip). Scan a return's
// key tag; FG resolves it, quietly registers/backfills the fleet from the full read, and if the
// car went out ON EXCEPTION opens the photo-comparison re-hold right there (the same
// HoldContextPanel the Holds screen uses) so the old-vs-new call is made while the tag's in hand,
// not hours later when it may be recirculating. Capture odo + fuel + damaged, add to the shift
// list, and copy a minimal plate-keyed block for the counter. Thin: resolve + route; the fleet
// writes and the re-hold machinery keep their own homes.
import { useState } from 'react';
import { MESSAGE_TONE, type MessageTone, type ToneMessage } from '../../lib/messageTone';
import { TONE_TEXT } from '../../lib/scanStatusLine';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useAirportFlip } from '../../hooks/useAirportFlip';
import { KeytagSearchScan } from '../holds/KeytagSearchScan';
import { HoldContextPanel } from '../holds/HoldContextPanel';
import { resolveKeytagScan, newVehicleToRegisterOnScan, backfillFieldsOnScan } from '../../lib/resolveKeytagScan';
import { NeededClasses } from './NeededClasses';
import { FlipRowsList } from './FlipRowsList';
import { checkKeys, keyShortNoteFor, keyOptionsFor, keyShortSeverity } from '../../lib/keyCount';
import { parseOdometer, describeOdometer, odometerUnitFor } from '../../lib/odometer';
import { isOnExceptionStatus } from '../../lib/vehicle-status';
import { useGeotabPending } from '../../hooks/useGeotabPending';
import { FuelLevelSelector, FUEL_LABELS } from '../shared/FuelLevelSelector';
import { BatteryLevelSelector } from '../shared/BatteryLevelSelector';
import { isEvModel } from '../../../api/_lib/vehicleClassCodex';
import { EVAssetCheck } from '../movement/EVAssetCheck';
import { toEvStatus } from '../../lib/ev-detection';
import { useUserResolver } from '../../hooks/useUserResolver';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import type { EvAssetStatus, Vehicle } from '../../types';

const INPUT = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';
const onException = (v: Vehicle | null) => !!v && isOnExceptionStatus(v.status);

export function AirportFlipSection() {
  const { user } = useAuth();
  const { vehicles, addVehicle, updateVehicleFields, getHoldsForVehicle, addHold, updateVehicleEVAssets, recordOdometer, recordKeyCount, attachKeytagPhotoIfMissing } = useVehicleHoldContext();
  const flip = useAirportFlip();
  // Classes turned around this shift (uppercased) → drives the "Needed" strip's satisfied ✓ state.
  const flippedClasses = new Set(flip.rows.map(r => (r.rentalClass ?? '').trim().toUpperCase()).filter(Boolean));
  const { getName } = useUserResolver();
  const checkGeotab = useGeotabPending();

  const [capture, setCapture] = useState<{ plate: string; unit: string | null; rentalClass: string; vehicle: Vehicle | null; isTesla: boolean; isEv: boolean; vehicleId: string | null } | null>(null);
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
  // ⭐ The KIND of message travels with it. This used to be a bare string rendered in HARD-CODED
  // green, so "Could not read that tag — try again." and "Enter a plate to continue." were painted
  // as successes. `say` takes the tone explicitly — no default, because a default is what let the
  // sibling surface (TripStartForm) announce a registration on alert red for months.
  const [toast, setToast] = useState<ToneMessage | null>(null);
  const say = (message: string, tone: MessageTone) => setToast({ message, tone });
  // Manual plate entry — the fallback when the AI scan is down (Anthropic busy) or misreads a
  // plate. The scan is a speed layer; the plate is the real identity key, so the flip must not
  // stop just because vision is unavailable.
  const [manualPlate, setManualPlate] = useState('');

  // Diffed against what the car is SUPPOSED to carry, so FG says "a key short" instead of just
  // storing a number. Null keys = not counted; a car with no baseline seeds it from this count.
  const keyCheck = keys !== null ? checkKeys(capture?.vehicle?.keyCount ?? null, keys) : null;

  // Open the capture card for a resolved (plate, vehicle) — shared by the scan path AND the manual
  // plate fallback so they can never drift into two half-implementations. Seeds the geotab check +
  // EV asset boxes from the record (last known, or present for a car never assessed — the same
  // `?? present` default the EV Assets tab uses), then clears the capture fields.
  const openCapture = async (cap: NonNullable<typeof capture>, vehicle: Vehicle | null) => {
    setCapture(cap);
    setGeotabPending(await checkGeotab(cap.plate));
    setCable(toEvStatus(vehicle?.hasMobileCable) ?? 'present');
    setAdapter(toEvStatus(vehicle?.hasJ1772Adapter) ?? 'present');
    setOdo(''); setFuelLevel(null); setBatteryPct(null); setKeys(null); setDamaged(false); setNotes('');
  };

  // Scan a return → resolve + enrich the fleet from the WHOLE read (register new / backfill partial),
  // then open the capture card. New cars / too-partial reads no-op the fleet write; never blocks.
  const onScan = async (read: KeytagRead, photo: string) => {
    const { plate, vehicle } = resolveKeytagScan(read, vehicles);
    if (!plate) { say('Could not read that tag — try again.', 'alert'); return; }
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
    // EV = Tesla OR a battery-EV model (Niro EV, …) — from the fleet record or the tag's codex-
    // resolved make/model. Drives the charge-% gauge instead of a gas reading. (ticket-ev-fuel-percentage.)
    const isEv = isTesla || isEvModel(vehicle?.model) || isEvModel(read.model);
    const vehicleId = vehicle?.id ?? registeredId ?? null;
    await openCapture({
      plate,
      unit: vehicle?.unitNumber ?? read.unitNumber ?? null,
      rentalClass: read.rentalClass ?? '',
      vehicle,
      isTesla,
      isEv,
      vehicleId,
    }, vehicle);
    // Keep the tag itself on the record — the evidence a misread can be audited against.
    // Best-effort and fire-and-forget: never delays the capture card.
    if (vehicleId) void attachKeytagPhotoIfMissing(vehicleId, photo);
  };

  // Manual plate fallback: normalize the plate (same MB-prefix safety net the scan uses), match it
  // to the fleet, and open the same capture card. A KNOWN plate carries its full record (class,
  // keys, EV assets); an UNKNOWN plate still captures for the counter (they search by plate) — it's
  // just not auto-registered as a new fleet car, matching the scan path's "only register a complete
  // identity" rule (a bare plate is too partial to mint a real vehicle record).
  const submitManualPlate = () => {
    // ⚠️ Typed, therefore never corrected — see ScanRouterOverlay.onManualPlate. The misread
    // corrector belongs under a camera, not under his thumbs.
    const plate = manualPlate.trim().toUpperCase().replace(/\s+/g, '');
    if (!plate) { say('Enter a plate to continue.', 'alert'); return; }
    const vehicle = vehicles.find(v => v.licensePlate.trim().toUpperCase() === plate) ?? null;
    void openCapture({
      plate,
      unit: vehicle?.unitNumber ?? null,
      rentalClass: vehicle?.rentalClass ?? '',
      vehicle,
      isTesla: !!vehicle?.isTesla,
      isEv: !!vehicle?.isTesla || isEvModel(vehicle?.model),
      vehicleId: vehicle?.id ?? null,
    }, vehicle);
    setManualPlate('');
    // ⚠️ NOTICE, not alert — nothing failed here. The flip proceeds and the car is captured; he
    // just needs to know it isn't on file. Forcing this red would be the same lie in the other
    // direction, which is why the tone axis has three values instead of two.
    if (!vehicle) say(`${plate} — not on file, capturing for the counter.`, 'notice');
  };

  const addToList = () => {
    if (!capture) return;
    const level = capture.isEv
      ? (batteryPct !== null ? `${batteryPct}%` : '')
      : (fuelLevel !== null ? FUEL_LABELS[fuelLevel] : '');
    // A short ring rides the counter copy-out — actionable while the rental is still open.
    // The counter copy-out carries the SAME severity the screen showed — a grounded Tesla must not
    // reach the counter described as a short ring.
    const shortNote = keyCheck ? keyShortNoteFor(keyCheck, capture.vehicle?.isTesla === true) : '';
    const counterNotes = [notes.trim(), shortNote].filter(Boolean).join(' · ');
    flip.add({ plate: capture.plate, unit: capture.unit, rentalClass: capture.rentalClass, odo, fuel: level, isEv: capture.isEv, damaged, notes: counterNotes });
    // Latest count is the new truth (and seeds the baseline the first time a car is counted).
    if (keys !== null && capture.vehicleId) void recordKeyCount(capture.vehicleId, keys);
    // The odo he already typed for the counter — kept rather than discarded (migration 123). Free
    // data: it costs him nothing extra, and it is what the airport is actually asking about when
    // they want "a high-km out-of-province car for a one-way".
    const km = parseOdometer(odo);
    if (km !== null && capture.vehicleId) void recordOdometer(capture.vehicleId, km);
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
      say(`Copied ${text.split('\n').length} for the counter · marked sent`, 'success');
      setTimeout(() => setToast(null), 3000);
    } catch { say('Copy failed — long-press the list to copy manually.', 'alert'); }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">✈️ Airport Flip</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Scan a return — record odo, fuel, damage for the counter. Clears at end of shift.</p>
        </div>
        {/* Shift scoreboard — how many returns turned around altogether this shift. Counts every
            scanned row (copy only marks rows sent, never removes them), so it climbs all shift and
            zeroes only at end-of-shift clear. The per-class breakdown lives with the rows below. */}
        {flip.rows.length > 0 && (
          <div className="shrink-0 rounded-lg border border-fg-yellow/40 bg-fg-yellow/10 px-2.5 py-1 text-center leading-none">
            <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{flip.rows.length}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">flipped</p>
          </div>
        )}
      </div>

      <NeededClasses flippedClasses={flippedClasses} />

      {!capture ? (
        <div className="space-y-2">
          <KeytagSearchScan onPlate={() => {}} onRead={(read, photo) => void onScan(read, photo)} />
          {/* Manual plate fallback — flip keeps going if the AI scan is down or misreads. */}
          <div className="flex items-center gap-2">
            <input
              className={INPUT}
              value={manualPlate}
              onChange={e => setManualPlate(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') submitManualPlate(); }}
              placeholder="or type a plate — if the scan's down"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={submitManualPlate}
              disabled={!manualPlate.trim()}
              className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              Enter
            </button>
          </div>
        </div>
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

          <div>
            <input className={INPUT} inputMode="numeric" placeholder={`Odometer (${odometerUnitFor(capture.vehicle?.isUs)})`} value={odo} onChange={e => setOdo(e.target.value)} />
            {/* What FG last heard, WITH its age — so a four-month-old figure can't pass for current
                (see lib/odometer). Also a free sanity check: a reading below this one is a misread,
                and the write refuses it rather than rewriting a good record. */}
            {capture.vehicle?.odometer ? (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                {/* ⚠️ THE UNIT, which this call was missing — it defaulted to km and would have
                    labelled the US Jeep's 23,175 MILES as kilometres, on the very screen where the
                    counter is told a car's mileage. Fourth instance of this same miss around the
                    odometer (the record chip 2026-08-27, the input control beside it, the jump
                    guard 2026-08-31); found by sweeping when Aaron mentioned FG had a second US
                    car. A unit is part of the number. */}
                last recorded {describeOdometer(capture.vehicle.odometer, capture.vehicle.odometerAt, new Date(), odometerUnitFor(capture.vehicle.isUs))}
              </p>
            ) : null}
          </div>

          {/* The gauge mirrors the instrument: a gas dash reads eighths, a Tesla's reads a %. */}
          {capture.isEv
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
                {capture.vehicle?.isTesla ? '⚡ Keycard' : '🔑 Keys on ring'}
                {capture.vehicle?.keyCount ? <span className="ml-1.5 normal-case font-normal text-gray-400">went out with {capture.vehicle.keyCount}</span> : null}
              </span>
              <div className="flex gap-1">
                {/* One card on a Tesla — the other three were never answerable. See lib/keyCount. */}
                {keyOptionsFor(capture.vehicle?.isTesla === true).map(n => (
                  <button key={n} type="button" onClick={() => setKeys(keys === n ? null : n)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold border transition cursor-pointer ${keys === n ? 'bg-fg-yellow border-fg-yellow text-black' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {/* ⚠️ A missing Tesla keycard is not a short return, it is an immobilised car — so it must
                not render in the same tone as "one key short". The severity belongs to the vehicle,
                not to the number (Aaron, 2026-08-19). */}
            {keyCheck && keyCheck.short > 0 && (
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                {keyShortNoteFor(keyCheck, capture.vehicle?.isTesla === true)}
                {keyShortSeverity(keyCheck, capture.vehicle?.isTesla === true) === 'grounded'
                  ? ' — do not stage it; it cannot be moved without the card.'
                  : ' — flag it at the counter while the contract is open.'}
              </p>
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

      {/* ⚠️ The colour follows the MESSAGE now. This line was hard-coded green, so the two
          error paths above rendered as confirmations. Reuses FG's existing colour vocabulary
          (scanStatusLine's TONE_TEXT) rather than growing a second one. */}
      {toast && <p className={`text-xs ${TONE_TEXT[MESSAGE_TONE[toast.tone]]}`}>{toast.message}</p>}

      <FlipRowsList flip={flip} onCopy={() => void copyForCounter()} />
    </div>
  );
}
