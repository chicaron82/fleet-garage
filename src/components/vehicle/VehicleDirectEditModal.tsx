import { useState } from 'react';
import { classPinContradiction } from '../../../api/_lib/vehicleClassCodex';
import { UnitNumberInput, PlateInput } from '../shared/VehicleFields';
import { VehicleIdentityFields } from '../shared/VehicleIdentityFields';
import { INPUT } from '../shared/vehicleCatalogue';
import { ClassChipPicker } from './ClassChipPicker';
import { plausibleYearOr } from '../../lib/vehicles';
import type { FieldSource } from '../../types';

interface VehicleDirectEditModalProps {
  vehicleId: string;
  initialUnitNumber: string | null;
  initialLicensePlate: string;
  initialMake: string;
  initialModel: string;
  initialYear: number;
  initialColor: string;
  initialRentalClass: string | null;
  /** The class code the record's identity was resolved from (migration 120). Null before then. */
  initialClassCode?: string | null;
  initialIsHybrid?: boolean;
  /** Per-field provenance — a 'manual' entry LOCKS that field against future tag reads. Undefined/
   *  absent-key fields render with no lock indicator (inferred/tag-sourced, freely overwritable). */
  fieldSources?: Record<string, FieldSource>;
  onClose: () => void;
  directEditVehicleIdentity: (
    vehicleId: string,
    unitNumber: string | null,
    licensePlate: string,
    identity?: { make: string; model: string; year: number; color: string; rentalClass: string | null; classCode?: string | null; isHybrid?: boolean },
  ) => Promise<void>;
  /** Release a manual lock on one field, WITHOUT touching its value — a future scan can update it
   *  again. A separate action from Save on purpose: unlocking and editing are different decisions. */
  onUnlockField: (field: string) => Promise<void>;
}

/** A small 🔒 + "Unlock" pair, shown only when this field is manually locked. Tapping it releases
 *  the lock immediately (its own write) — it does not require Save. */
function LockBadge({ field, locked, onUnlock, unlocking }: {
  field: string; locked: boolean; onUnlock: () => void; unlocking: boolean;
}) {
  if (!locked) return null;
  return (
    <button
      type="button"
      onClick={onUnlock}
      disabled={unlocking}
      title={`Locked by your edit — no scan overrides ${field}. Tap to let tags update it again.`}
      className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 disabled:opacity-50 cursor-pointer normal-case"
    >
      🔒 {unlocking ? 'Unlocking…' : 'Unlock'}
    </button>
  );
}

export function VehicleDirectEditModal({
  vehicleId,
  initialUnitNumber,
  initialLicensePlate,
  initialMake,
  initialModel,
  initialYear,
  initialColor,
  initialRentalClass,
  initialClassCode,
  initialIsHybrid,
  fieldSources,
  onClose,
  directEditVehicleIdentity,
  onUnlockField,
}: VehicleDirectEditModalProps) {
  const [editUnit, setEditUnit] = useState(initialUnitNumber ?? '');
  const [editPlate, setEditPlate] = useState(initialLicensePlate);
  const [editMake, setEditMake] = useState(initialMake);
  const [editModel, setEditModel] = useState(initialModel);
  // Seed a blank/unknown/mis-read year to the current year so the stepper starts in range.
  const [editYear, setEditYear] = useState(plausibleYearOr(initialYear, new Date().getFullYear()));
  const [editColor, setEditColor] = useState(initialColor);
  const [editHybrid, setEditHybrid] = useState(!!initialIsHybrid);
  // Rental class (Q4, E6, P4, R…). Editing it here LOCKS it against future tag reads — the fix for
  // a tag that maps to the wrong class (CCLH→Corolla when the car's really a Camry, or class F where
  // it should be E6). Freeform short code, upper-cased on save.
  const [editClass, setEditClass] = useState(initialRentalClass ?? '');
  // The code the record's identity CAME FROM. Stored since migration 120; null on every car
  // registered before then, and it fills in as tags get scanned.
  const [editClassCode, setEditClassCode] = useState(initialClassCode ?? '');
  const [editSaving, setEditSaving] = useState(false);
  // Which field's unlock is in flight — disables just that badge, not the whole modal.
  const [unlockingField, setUnlockingField] = useState<string | null>(null);

  const canSave = !!editPlate.trim() && !!editMake && !!editModel && editYear > 1999 && !!editColor && !editSaving;

  const unlock = async (field: string) => {
    setUnlockingField(field);
    try { await onUnlockField(field); } finally { setUnlockingField(null); }
  };
  // The combined badge covers 4 real field_sources keys (make/model/year/color lock together at
  // save-time) — 'identity' isn't itself a key, so release each of the four underlying ones.
  // SEQUENTIAL, not Promise.all: onUnlockField is read-modify-write (reads current field_sources,
  // drops one key, writes back), so firing all four concurrently would have them all read the SAME
  // stale snapshot and clobber each other — only the last write landing, the other three keys
  // still locked. Awaiting one at a time means each read sees the previous unlock's write.
  const unlockIdentity = async () => {
    setUnlockingField('identity');
    try { for (const f of ['make', 'model', 'year', 'color']) await onUnlockField(f); }
    finally { setUnlockingField(null); }
  };
  // Save stamps make/model/year/color as ONE bundle (directEditVehicleIdentity), so they show a
  // single combined lock rather than four independent ones that don't reflect how locking actually
  // happens today.
  const identityLocked = fieldSources?.make === 'manual' || fieldSources?.model === 'manual'
    || fieldSources?.year === 'manual' || fieldSources?.color === 'manual';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 bg-black/40">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
            Edit Vehicle
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Unit Number
                <LockBadge field="unit number" locked={fieldSources?.unitNumber === 'manual'}
                  onUnlock={() => unlock('unitNumber')} unlocking={unlockingField === 'unitNumber'} />
              </label>
              <UnitNumberInput
                value={editUnit}
                onValueChange={setEditUnit}
                placeholder="Unit # (blank if unknown)"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                License Plate
              </label>
              <PlateInput
                value={editPlate}
                onValueChange={setEditPlate}
                className={INPUT}
              />
            </div>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Vehicle Identity
              <LockBadge field="make/model/year/color" locked={identityLocked}
                onUnlock={unlockIdentity} unlocking={unlockingField === 'identity'} />
            </span>
          </div>
          <VehicleIdentityFields
            make={editMake}
            model={editModel}
            year={editYear}
            color={editColor}
            onMake={setEditMake}
            onModel={setEditModel}
            onYear={setEditYear}
            onColor={setEditColor}
            isHybrid={editHybrid}
            onHybrid={setEditHybrid}
          />
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Rental Class <span className="normal-case font-normal text-gray-400">(locks against tag reads)</span>
              <LockBadge field="rental class" locked={fieldSources?.rentalClass === 'manual'}
                onUnlock={() => unlock('rentalClass')} unlocking={unlockingField === 'rentalClass'} />
            </label>
            <ClassChipPicker value={editClass} onChange={setEditClass} />
          </div>

          {/* The class code — the tag field this record's make and model were RESOLVED from.
              Shown here because a wrong code is invisible everywhere else: the car looks correct
              while the code that produced it is wrong, and that same code is what the codex learns
              from. Empty on any car registered before 2026-08-19; it fills in as tags are scanned. */}
          <div>
            <label htmlFor="edit-class-code" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Model Code <span className="normal-case font-normal text-gray-400">(the 4-letter code — NOT the rental class)</span>
            </label>
            <input
              id="edit-class-code"
              value={editClassCode}
              onChange={e => setEditClassCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Not recorded"
              className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono font-semibold tracking-wider text-gray-900 dark:text-gray-100"
            />
            {/* ⭐⭐ THE SLIP THIS CATCHES, IN HIS WORDS: *"me flipping the hybrid checkbox but
                forgetting to change the model code."* On 2026-08-28 that edit pinned `CSPT → E6`
                from a Sportage hybrid wearing a mis-printed ICE tag — true of the car in his hand,
                false of the eleven petrol Sportages, and LOCKED so no scan could undo it.

                ⚠️ Shown WHILE HE EDITS, not after saving: this modal closes on save, so a message
                on the result is a message nobody reads. And it only ever OFFERS — the tag may
                genuinely be mis-printed, which is precisely why he is in here correcting the car. */}
            {(() => {
              const c = classPinContradiction(editClassCode, editClass);
              return c ? (
                <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠️ <span className="font-mono font-semibold">{c.rentalClass}</span> is the hybrid class, but{' '}
                  <span className="font-mono font-semibold">{c.code}</span> is the petrol code for this model.{' '}
                  <button type="button" onClick={() => setEditClassCode(c.hybridCode)}
                    className="font-semibold underline cursor-pointer">
                    use {c.hybridCode}
                  </button>
                  {' '}— or leave it, and the shared code→class mapping just won't be pinned.
                </p>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={async () => {
              setEditSaving(true);
              await directEditVehicleIdentity(
                vehicleId,
                editUnit.trim() || null,
                editPlate.trim().toUpperCase(),
                { make: editMake, model: editModel, year: editYear, color: editColor, rentalClass: editClass.trim() || null, classCode: editClassCode.trim().toUpperCase() || null, isHybrid: editHybrid },
              );
              setEditSaving(false);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold transition cursor-pointer"
          >
            {editSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
