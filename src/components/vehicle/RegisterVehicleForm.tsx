import { RegisterVehicleFlags } from './RegisterVehicleFlags';
import { useState, useRef } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useAuth } from '../../context/AuthContext';
import { useRoutedProp } from '../../hooks/useRoutedProp';
import { hapticMedium } from '../../lib/haptics';
import { useVehicleByPlate } from '../../hooks/useVehicleByPlate';
import { plausibleYearOr } from '../../lib/vehicles';
import { runRegisterFollowUps } from '../../context/registerFollowUps';
import type { ScannedIdentity, EvAssetStatus } from '../../types';
import { usePlateRecognition } from '../../hooks/usePlateRecognition';
import { describeKnownPlate } from '../../lib/vehicleByPlate';
import { useUnitConflict } from '../../hooks/useUnitConflict';
import { UnitNumberInput, PlateInput, KeyCountSelector } from '../shared/VehicleFields';
import { VehicleIdentityFields } from '../shared/VehicleIdentityFields';
import { INPUT } from '../shared/vehicleCatalogue';
import { UnitConflictNotice } from './UnitConflictNotice';
import { RegisterResultBanners } from './RegisterResultBanners';
import { RegisterClassCode } from './RegisterClassCode';
import type { RegisterSuccessToast, RegisterReleaseWarning } from './RegisterResultBanners';
import { EVAssetCheck } from '../movement/EVAssetCheck';

interface Props {
  prefill?: string;
  /** A key-tag scan's full read — seeds every field it captured, so a scan never asks the
   *  operator to retype what FG just read. Falls back to `prefill` (plate-or-unit) when absent. */
  scanned?: ScannedIdentity;
  /** The compressed key-tag photo the scan was read from — attached to the NEW vehicle on register
   *  so the source tag is on file (the scan-router only attaches for already-known cars). */
  keytagPhoto?: string;
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

export function RegisterVehicleForm({ prefill, scanned, keytagPhoto, onBack, onSuccess, returnTo = 'hold' }: Props) {
  const { addVehicle, allVehicles, releaseUnitNumber, attachKeytagPhotoIfMissing, restoreVehicle, updateVehicleEVAssets } = useVehicleHoldContext();
  const { user } = useAuth();
  const { remember } = useVehicleByPlate();
  const seed = classifyPrefill(prefill);

  const currentYear = new Date().getFullYear();

  const [unit, setUnit] = useState(scanned?.unitNumber ?? seed.unit);
  const [plate, setPlate] = useState(scanned?.plate ?? seed.plate);
  const [make, setMake] = useState(scanned?.make ?? '');
  const [model, setModel] = useState(scanned?.model ?? '');
  // A handwritten tag can mis-read the year (e.g. `10`) or leave it blank (0). Either way, seed
  // the ±1 stepper at a plausible year rather than dozens of taps from the truth. plausibleYearOr
  // catches the non-null garbage that `?? currentYear` alone would let through.
  const [year, setYear] = useState(plausibleYearOr(scanned?.year, currentYear));
  const [color, setColor] = useState(scanned?.color ?? '');
  // Hybrid flag — an attribute now, not a "<Base> Hybrid" model. Pre-checked when the scanned tag's
  // class code is a hybrid variant (codex hint); otherwise operator-checked, defaults off.
  const [isHybrid, setIsHybrid] = useState(scanned?.isHybrid ?? false);
  // ⚠️ `winterTires` starts NULL, not false — an untouched control writes nothing (the EV-asset
  // rule). Otherwise every car he registers and walks away from would report its tyres as summer.
  const [isUs, setIsUs] = useState(false);
  const [winterTires, setWinterTires] = useState<boolean | null>(null);
  // Rental class is read off the tag, not operator-typed — carried through to the insert.
  const [rentalClass, setRentalClass] = useState(scanned?.rentalClass ?? '');
  // ⚠️ EDITABLE, and that is the whole point. `teachClassCode` is present only when the codex
  // couldn't resolve the code — i.e. registering this car will TEACH FG what the code means. So it
  // is simultaneously the most consequential field on the form and, until now, the only one the
  // operator could neither see nor correct. On 2026-08-19 a Seltos tag read CKSE as CKSP; Aaron
  // corrected the make and model, and FG dutifully taught the MISREAD code the right car — while
  // the real code stayed unknown, so the next Seltos would misread and teach again.
  const [classCode, setClassCode] = useState(scanned?.classCode ?? scanned?.teachClassCode ?? '');
  const [keyCount, setKeyCount] = useState<number | null>(null);
  // ⚡ The EV asset check made at the car, on the SAME control as the other five surfaces
  // (`EVAssetCheck`). Seeded null and filled to 'present' by that control on mount, so the common
  // case — both there, which is nearly always — costs zero taps; "Didn't check" clears them back
  // to null and registers as not assessed. This screen used to roll its own gate-plus-four-buttons
  // dialect; see EVAssetCheck's `allowNotChecked` for why that inverted.
  const [cable, setCable] = useState<EvAssetStatus | null>(null);
  const [adapter, setAdapter] = useState<EvAssetStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
    setYear(plausibleYearOr(s.year, currentYear));
    setColor(s.color ?? '');
    setRentalClass(s.rentalClass ?? '');
    setClassCode(s.classCode ?? s.teachClassCode ?? '');
    setIsHybrid(s.isHybrid ?? false);
    // The EV check belongs to the car he was looking at, not to the form. A new scan is a new
    // car, so the assessment resets with it — otherwise car A's cable status rides onto car B,
    // which is precisely the failure this whole re-seed exists to prevent.
    //
    // Back to 'present', NOT null: the control's default is mount-only, and this component stays
    // mounted across a re-scan, so seeding null here would leave car B stuck at "not assessed"
    // with nothing to fill it — a silent downgrade of the zero-tap default.
    setCable('present');
    setAdapter('present');
  });

  // Carries its own tone: the registration can succeed while a follow-on write fails, and a
  // warning rendered in the green success toast would be a lie about what actually landed.
  const [successToast, setSuccessToast] = useState<RegisterSuccessToast | null>(null);
  // Set when the conflict reconciliation's release half failed — the new vehicle
  // is registered, but the OLD record still carries the unit#. Non-blocking warning.
  const [releaseWarning, setReleaseWarning] = useState<RegisterReleaseWarning | null>(null);
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
      // The code he CONFIRMED on the form — stored on the car so its identity stays checkable
      // against what produced it (migration 120). Blank stores nothing, same as it teaches nothing.
      classCode:      classCode.trim().toUpperCase() || null,
        keyCount:       effectiveKeyCount,
        branchId:       user?.branchId,
        isTesla,
        isHybrid,
        isUs,
        // Only an OBSERVED value travels, with the moment he made it. Null stays null all the way
        // to the column, where it honestly means "nobody has looked".
        winterTires,
        winterTiresAt: winterTires === null ? null : new Date().toISOString(),
        // EV assets register as "not assessed" (null) — never assume present. The insert NEVER
        // carries a status, even when he assessed them on the form: an assessment is a logged
        // observation with a source, so it goes through updateVehicleEVAssets below and lands in
        // the asset history. Writing it here instead would put the status on the car with no
        // record of who saw it or where — the one thing this rule exists to prevent.
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
      // Everything after the insert — tag photo, EV asset log, unit-number release, registry
      // promotion, codex teach. All best-effort by design and NONE of them may fail the
      // registration; the two whose failure he needs to know about come back reported.
      const codeToTeach = classCode.trim().toUpperCase();
      const { evLogFailed, releaseFailed } = await runRegisterFollowUps({
        vehicleId: id, unit: unit.trim(), plate: plate.trim(), make, model, isTesla,
        cable, adapter, keytagPhoto,
        conflictVehicleId: armed && unitConflict ? unitConflict.id : undefined,
        teachCode: scanned?.teachClassCode && codeToTeach ? codeToTeach : undefined,
        userId: user?.id,
      }, { attachKeytagPhotoIfMissing, updateVehicleEVAssets, releaseUnitNumber, remember });
      hapticMedium();
      if (releaseFailed && unitConflict) {
        // Registration succeeded; only the old record's cleanup failed. Warn and
        // auto-proceed — non-blocking (the new vehicle is already correct).
        setReleaseWarning({ old: unitConflict.licensePlate, vehicleId: id });
        navTimer.current = setTimeout(() => onSuccess(id), 5000);
      } else if (evLogFailed) {
        // The car registered; only the asset log didn't land. Say so on EVERY return path — the
        // hold path normally navigates silently, and silence here would let him walk away
        // believing the cable was recorded. Knowing instead of assuming is the whole point of
        // the block; a check that quietly evaporated is worse than never offering it.
        setSuccessToast({ text: `⚠️ ${unit.trim()} registered — the EV asset check didn't save. Log it in the EV Assets tab.`, tone: 'warn' });
        setTimeout(() => onSuccess(id), 3500);
      } else if (returnTo === 'fleet') {
        setSuccessToast({ text: `✅ Vehicle ${unit.trim()} registered`, tone: 'ok' });
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
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Add to FG</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Vehicle Details
            </h2>

            {/* ── FIRST, deliberately ──────────────────────────────────────────────────────────
                This is the baseline the check-in diffs against, and it must be set while the ring
                is in hand: a car whose first count happens on an already-short return would seed
                its baseline low and hide the loss. Optional — left blank, the first count seeds it.

                It leads the form because it is the ONLY question left. The key tag prints the unit
                number, plate, rental class, year and colour, and the scan reads them accurately
                enough that Aaron never edits them — but no tag can say how many keys are physically
                on the ring. That takes his eyes on the object.

                It used to sit LAST, below every scan-filled field, so the form led with the answers
                and buried the question. Aaron, mid-shift 2026-08-17: *"the scan is generally
                accurate so I rarely have to make corrections on the unit number. so when I register
                one I need to scroll a bit to tap the # of keys"* — and the numeric keypad covers the
                bottom of the screen, which is exactly where it was. At the top it cannot be covered
                by the keypad no matter which field has focus. Everything below is now what he
                actually treats it as: a confirmation block, not a form. */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                🔑 Keys on the ring{make === 'Tesla' && <span className="text-blue-600 dark:text-blue-400"> — key card</span>}
              </span>
              {/* 44px, the Apple/Google minimum touch target — swept here at the same time as the
                  scan card's row (2026-08-18). These were 32px, 4px apart, and this row is now the
                  FIRST thing he touches on the form, tapped with nitrile gloves on.
                  ⚠️ SHARED WITH THE KEY-TAG AUDITOR since 2026-08-30 — this markup had been copied
                  into `KeytagAuditFields` rather than reached for, which is how one control became
                  two definitions of the same 44px row. Same buttons, same hands, same standard, and
                  now literally the same component. */}
              <KeyCountSelector
                value={effectiveKeyCount === null ? '' : String(effectiveKeyCount)}
                onValueChange={v => setKeyCount(v === '' ? null : Number(v))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Unit #</label>
                <UnitNumberInput
                  value={unit}
                  onValueChange={setUnit}
                  placeholder="e.g. 5428735"
                  /* Focus only an EMPTY unit number. Unconditional autoFocus put the cursor in a
                     numeric field that a key-tag scan had already filled correctly — raising the
                     keypad over the form for a field Aaron never edits, which is what buried the
                     key-count selector he actually came to tap (`34b7ffb`).

                     Keyed on `unit` rather than on `scanned`, deliberately: the useful question is
                     "is there anything here?", not "how did we get here". A manual add focuses
                     (nothing to read), a scan that captured the unit does not, and a scan whose
                     unit came back BLANK still focuses — which `!scanned` would have missed, since
                     `scannedFromRead` returns '' rather than null for a field the tag didn't give
                     up. Evaluated at mount, which is the only moment autoFocus means anything. */
                  autoFocus={!unit}
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
                plateMatch.archivedAt ? (
                  // An ARCHIVED car (sold/auctioned) coming back. It's the SAME vehicle — management
                  // bounces cars in/out of auction on the fly, off-FG — so re-registering would mint a
                  // duplicate EVERY cycle. The right move is to RESTORE the existing row (un-archive +
                  // return it CLEAN), not create a new one. See restoreVehicle.
                  <div className="rounded-lg border border-slate-300 dark:border-slate-600/60 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 space-y-2">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      🗄️ This car is archived{describeKnownPlate(plateMatch) ? ` — ${describeKnownPlate(plateMatch)}` : ''} (archived {new Date(plateMatch.archivedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}). It's the same vehicle — restore it instead of creating a duplicate.
                    </p>
                    <button
                      type="button"
                      disabled={restoring}
                      onClick={async () => {
                        if (!plateMatch.vehicleId) return;
                        setRestoring(true);
                        await restoreVehicle(plateMatch.vehicleId);
                        hapticMedium();
                        onSuccess(plateMatch.vehicleId);
                      }}
                      className="w-full rounded-lg bg-slate-700 dark:bg-slate-600 text-white text-xs font-semibold py-1.5 hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-50 transition-colors"
                    >
                      {restoring ? 'Restoring…' : '↩ Restore to fleet'}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      ⚠️ This plate is already on a registered vehicle{describeKnownPlate(plateMatch) ? ` — ${describeKnownPlate(plateMatch)}` : ''}. Adding it again creates a duplicate.
                    </p>
                  </div>
                )
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
              isHybrid={isHybrid}
              onHybrid={setIsHybrid}
            />

            <RegisterVehicleFlags
              isUs={isUs}
              onIsUs={setIsUs}
              winterTires={winterTires}
              onWinterTires={setWinterTires}
            />

            {/* ⚠️ SHOWN WHENEVER THE READ CARRIED A CODE — not only when the codex missed. It used
                to be gated on `teachClassCode`, i.e. on FAILURE, so a misread code that happened to
                RESOLVE was invisible: make and model filled in, looked right, and nothing said the
                four characters underneath were wrong. The case that most needs confirming was the
                one that was hidden. Aaron, 2026-08-26: "the model code isn't here to confirm it was
                read correctly." See RegisterClassCode.

                ⚠️ Gated on the SCAN's fields, not the live draft. It briefly read
                `classCode.trim() &&` — which unmounted the control the moment he cleared the box
                (an input that vanishes mid-edit), and made RegisterClassCode's own blank-state
                message ("FG learns nothing from this tag") unreachable dead code: the child had a
                branch for empty, the parent guaranteed non-empty. A truly code-less read (a
                handwritten tag) still renders nothing. Found by the flow suite, /line-check
                2026-08-27. */}
            {(scanned?.classCode || scanned?.teachClassCode) && (
              <RegisterClassCode
                code={classCode}
                onChange={setClassCode}
                teaching={!!scanned?.teachClassCode}
              />
            )}

            {/* Rental class is READ off the tag, not typed — show what FG captured (show-your-work)
                so the operator can confirm it before registering. Stored on the vehicle. */}
            {rentalClass && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {scanned?.rentalClassInferred
                    ? '↳ Rental class inferred from the code (tag class unreadable)'
                    : 'Rental class read off the tag'}
                </span>
                <span className="rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-gray-800 dark:text-gray-100">{rentalClass}</span>
              </div>
            )}

          </div>

          {/* ⚡ The one EV control, same as trip start / the flip / the EV Assets tab / quick-add.
              `allowNotChecked` is what lets registration still say "not assessed" — the only
              surface that needs it, because a car can be registered off a tag away from its trunk. */}
          {make === 'Tesla' && (
            <EVAssetCheck
              cableStatus={cable} adapterStatus={adapter}
              onCableChange={setCable} onAdapterChange={setAdapter}
              allowNotChecked
            />
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
              {submitting ? 'Adding…' : 'Add to FG'}
            </button>
          </div>

        </form>
      </div>

      <RegisterResultBanners
        successToast={successToast}
        releaseWarning={releaseWarning}
        unit={unit.trim()}
        onAcknowledge={vehicleId => {
          if (navTimer.current) clearTimeout(navTimer.current);
          setReleaseWarning(null);
          onSuccess(vehicleId);
        }}
      />
    </div>
  );
}
