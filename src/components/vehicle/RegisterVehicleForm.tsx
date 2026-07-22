import { useState, useRef } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useAuth } from '../../context/AuthContext';
import { useRoutedProp } from '../../hooks/useRoutedProp';
import { hapticMedium } from '../../lib/haptics';
import { useVehicleByPlate } from '../../hooks/useVehicleByPlate';
import { teachClassCode } from '../../hooks/useUnknownClassCode';
import type { ScannedIdentity } from '../../types';
import { usePlateRecognition } from '../../hooks/usePlateRecognition';
import { describeKnownPlate } from '../../lib/vehicleByPlate';
import { useUnitConflict } from '../../hooks/useUnitConflict';
import { UnitNumberInput, PlateInput } from '../shared/VehicleFields';
import { VehicleIdentityFields } from '../shared/VehicleIdentityFields';
import { INPUT } from '../shared/vehicleCatalogue';
import { UnitConflictNotice } from './UnitConflictNotice';

interface Props {
  prefill?: string;
  /** A key-tag scan's full read — seeds every field it captured, so a scan never asks the
   *  operator to retype what FG just read. Falls back to `prefill` (plate-or-unit) when absent. */
  scanned?: ScannedIdentity;
  onBack: () => void;
  onSuccess: (vehicleId: string) => void;
  returnTo?: 'fleet' | 'hold';
}

function classifyPrefill(value?: string): { unit: string; plate: string } {
  if (!value) return { unit: '', plate: '' };
  // All digits → unit number; anything with letters → license plate
  return /^\d+$/.test(value)
    ? { unit: value, plate: '' }
    : { unit: '', plate: value };
}

export function RegisterVehicleForm({ prefill, scanned, onBack, onSuccess, returnTo = 'hold' }: Props) {
  const { addVehicle, allVehicles, releaseUnitNumber } = useVehicleHoldContext();
  const { user } = useAuth();
  const { remember } = useVehicleByPlate();
  const seed = classifyPrefill(prefill);

  const currentYear = new Date().getFullYear();

  const [unit, setUnit] = useState(scanned?.unitNumber ?? seed.unit);
  const [plate, setPlate] = useState(scanned?.plate ?? seed.plate);
  const [make, setMake] = useState(scanned?.make ?? '');
  const [model, setModel] = useState(scanned?.model ?? '');
  const [year, setYear] = useState(scanned?.year ?? currentYear);
  const [color, setColor] = useState(scanned?.color ?? '');
  // Rental class is read off the tag, not operator-typed — carried through to the insert.
  const [rentalClass, setRentalClass] = useState(scanned?.rentalClass ?? '');
  const [keyCount, setKeyCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // THE DANGEROUS ONE. All six fields above are seeded by `useState`, which reads only on MOUNT —
  // so scanning a second key tag from the header while this form was already open left every
  // identity field holding the PREVIOUS car's values. That's not a stale UI, it's wrong data
  // written to the fleet: register car B carrying car A's unit#, make, model and year.
  // Re-seed whenever a new scan arrives. Render-time adjustment (the repo lints
  // set-state-in-effect); `scanned` is a fresh object per navigation, so identity compare is right.
  // Same class as the movement-log prefill bug (9d1535f). docs/ticket-scan-router-trip-prefill.md
  useRoutedProp(scanned, s => {
    setUnit(s.unitNumber ?? seed.unit);
    setPlate(s.plate ?? seed.plate);
    setMake(s.make ?? '');
    setModel(s.model ?? '');
    setYear(s.year ?? currentYear);
    setColor(s.color ?? '');
    setRentalClass(s.rentalClass ?? '');
  });

  const [successToast, setSuccessToast] = useState<string | null>(null);
  // Set when the conflict reconciliation's release half failed — the new vehicle
  // is registered, but the OLD record still carries the unit#. Non-blocking warning.
  const [releaseWarning, setReleaseWarning] = useState<{ old: string; vehicleId: string } | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Recognize the plate as it's typed: a fleet match means it's already registered
  // (duplicate guard); a registry match means it was remembered earlier and
  // registering now promotes it to a real fleet vehicle. The onResolved callback
  // pre-fills the unit from a recognized sighting while the field is still empty
  // (functional update, so it never fights the user's own typing).
  const plateMatch = usePlateRecognition(plate, m => {
    if (m?.unitNumber) setUnit(prev => (prev.trim() === '' ? m.unitNumber! : prev));
  });

  // A different active vehicle already carrying this unit# — the conflict the
  // user can resolve by moving the number onto the record being registered.
  const { conflict: unitConflict, armed, arm, disarm } = useUnitConflict(unit, allVehicles);

  // A Tesla ships with exactly ONE key card — no ring, no variants, so the count is a property of
  // the make rather than an observation to make at the car. DERIVED, not a setState on make-change:
  // the selector shows 1 the moment Tesla is picked and un-defaults if the make changes again, with
  // no effect to keep in sync and nothing to go stale. Tapping another number still overrides it.
  const effectiveKeyCount = keyCount ?? (make === 'Tesla' ? 1 : null);

  const canSubmit = unit.trim() && plate.trim() && make && model && year > 1999 && color && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const isTesla = make === 'Tesla';
      const maybeId = await addVehicle({
        unitNumber:     unit.trim(),
        licensePlate:   plate.trim().toUpperCase(),
        make,
        model,
        year:           year,
        color,
        rentalClass:    rentalClass.trim() || null,
        keyCount:       effectiveKeyCount,
        branchId:       user?.branchId,
        isTesla,
        // EV assets register as "not assessed" (null) — never assume present.
        // The first real present/missing observation (and its timeline entry)
        // comes from the EV Assets tab / check-in, not from cataloging the car.
        hasMobileCable:  null,
        hasJ1772Adapter: null,
        // Fleet-add path has no hold — vehicle enters clean. Hold path lets
        // addVehicle default to HELD, then addHold overwrites it immediately.
        status: returnTo === 'fleet' ? 'CLEAR' : undefined,
      });
      // Dropped re-entrant submit (same plate already in flight) — the first
      // submission owns the success path; this one just stands down.
      if (!maybeId) return;
      const id = maybeId;
      hapticMedium();
      // Reconcile a confirmed unit# conflict: the new vehicle now carries the
      // number, so release it from the record it was stapled to in error. The
      // registration already succeeded — a failed release leaves a recoverable
      // duplicate, not a lost unit#, so it must not block the success path.
      let releaseFailed = false;
      if (armed && unitConflict) {
        // The release leaves a recoverable duplicate if it throws (caught on the
        // next conflict check) — but "recoverable" only helps if the VSA knows to
        // look, so surface it rather than swallowing it silently.
        try { await releaseUnitNumber(unitConflict.id); } catch { releaseFailed = true; }
      }
      // Promotion bookkeeping: point any remembered registry sighting for this
      // plate at the now-canonical vehicle (best-effort).
      void remember(plate.trim(), { vehicleId: id, unitNumber: unit.trim() });
      // The tag printed a code the codex couldn't resolve, and he just told us what the car IS —
      // so learn it. Next scan of this code fills make/model on its own. Best-effort by design.
      if (scanned?.teachClassCode) void teachClassCode(scanned.teachClassCode, make, model, user?.id);
      if (releaseFailed && unitConflict) {
        // Registration succeeded; only the old record's cleanup failed. Warn and
        // auto-proceed — non-blocking (the new vehicle is already correct).
        setReleaseWarning({ old: unitConflict.licensePlate, vehicleId: id });
        navTimer.current = setTimeout(() => onSuccess(id), 5000);
      } else if (returnTo === 'fleet') {
        setSuccessToast(`✅ Vehicle ${unit.trim()} registered`);
        setTimeout(() => onSuccess(id), 2500);
      } else {
        onSuccess(id);
      }
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="transition-colors">
      {/* Nav */}
      <nav className="bg-white dark:bg-gray-900 transition-colors border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Add to Ledger</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Vehicle Details
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Unit #</label>
                <UnitNumberInput
                  value={unit}
                  onValueChange={setUnit}
                  placeholder="e.g. 5428735"
                  autoFocus
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate</label>
                <PlateInput
                  value={plate}
                  onValueChange={setPlate}
                  placeholder="e.g. LFJ108"
                  className={INPUT}
                />
              </div>
            </div>

            {/* These conflict warnings are PRE-SUBMIT decision support ("you're about to make a
                duplicate"). Once submitting, they're moot — and they must hide, because addVehicle
                optimistically prepends the new car to the live list the hooks read, so during the
                ~2.5s success linger they'd otherwise flash "already registered / duplicate" about
                the car just created (LZM556 confusion, 2026-07-20). Gate on !submitting. */}
            {!submitting && plateMatch && (
              plateMatch.source === 'vehicle' ? (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    ⚠️ This plate is already on a registered vehicle{describeKnownPlate(plateMatch) ? ` — ${describeKnownPlate(plateMatch)}` : ''}. Adding it again creates a duplicate.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-teal-300 dark:border-teal-700/60 bg-teal-50 dark:bg-teal-900/20 px-3 py-2">
                  <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                    ✓ Seen before — recognized from a previous log. Adding it now promotes it to the fleet.
                  </p>
                </div>
              )
            )}

            {!submitting && unitConflict && (
              <UnitConflictNotice conflict={unitConflict} armed={armed} onArm={arm} onDisarm={disarm} />
            )}

            <VehicleIdentityFields
              make={make}
              model={model}
              year={year}
              color={color}
              onMake={setMake}
              onModel={setModel}
              onYear={setYear}
              onColor={setColor}
            />

            {/* Rental class is READ off the tag, not typed — show what FG captured (show-your-work)
                so the operator can confirm it before registering. Stored on the vehicle. */}
            {rentalClass && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Rental class read off the tag</span>
                <span className="rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-gray-800 dark:text-gray-100">{rentalClass}</span>
              </div>
            )}

            {/* The baseline the check-in diffs against. Set it HERE while the ring is in hand — a
                car whose first count happens on an already-short return would otherwise seed its
                baseline low and hide the loss. Optional: left blank, the first count seeds it. */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                🔑 Keys on the ring{make === 'Tesla' && <span className="text-blue-600 dark:text-blue-400"> — key card</span>}
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <button key={n} type="button" onClick={() => setKeyCount(effectiveKeyCount === n ? null : n)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold border transition cursor-pointer ${effectiveKeyCount === n ? 'bg-fg-yellow border-fg-yellow text-black' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Teslas register with EV assets unassessed — assessment is a logged
              action, done in the EV Assets tab, not assumed at registration. */}
          {make === 'Tesla' && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 p-4">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">⚡ EV Assets</p>
              <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                Registers as <span className="font-semibold">Not assessed</span>. Check the charge cable &amp; J1772 adapter in the <span className="font-semibold">EV Assets</span> tab — the first check logs the real status to the asset history.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-black font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding…' : 'Add to Ledger'}
            </button>
          </div>

        </form>
      </div>

      {successToast && (
        <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="px-5 py-3 rounded-2xl bg-green-800/90 text-white text-sm font-semibold shadow-xl backdrop-blur-sm">
            {successToast}
          </div>
        </div>
      )}

      {releaseWarning && (
        <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (navTimer.current) clearTimeout(navTimer.current);
              const { vehicleId } = releaseWarning;
              setReleaseWarning(null);
              onSuccess(vehicleId);
            }}
            className="max-w-md px-5 py-3 rounded-2xl bg-amber-600/95 text-white text-sm font-medium text-left shadow-xl backdrop-blur-sm transition hover:bg-amber-600 cursor-pointer"
          >
            ⚠️ Registered — but unit #{unit.trim()} couldn&apos;t be cleared from old record{' '}
            <span className="font-semibold">{releaseWarning.old}</span>. Check it and remove the unit# if
            needed. <span className="underline whitespace-nowrap">Got it →</span>
          </button>
        </div>
      )}
    </div>
  );
}
