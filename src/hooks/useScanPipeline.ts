import { useCallback } from 'react';
import { resolveKeytagScan } from '../lib/resolveKeytagScan';
import { recordSighting } from './useVehicleSightings';
import { logUnknownClassCode, teachClassCode } from './useUnknownClassCode';
import { isUnknownClassCode } from '../lib/partialRegister';
import { classCodeLessonFromScan, classCodeLearnedLabel } from '../lib/classCodeLesson';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../types';

// Everything that happens ONCE FG HAS A KEYTAG READ — resolve it against the fleet, record the
// sighting, quietly backfill the record, drain the codex's unknowns.
//
// ⭐ ONE PIPELINE, TWO ENTRY POINTS. The camera path and the typed-plate fallback both land here,
// so they cannot drift into two half-implementations — the mistake the register form's EV dialect
// was, caught the same day (2026-08-25).
//
// Lifted out of ScanRouterOverlay when adding the typed-plate fallback pushed that file to 332 of
// 330. It was always a separable unit; being inline is what made the overlay the biggest file in
// the module.
// ⚠️ MODULE SCOPE, NEVER PER-MOUNT — and I broke this while extracting. A scan is an EVENT, so its
// nonce must be monotonic for the life of the tab: a destination that has already consumed nonce 3
// must never be handed another 3. Declared inside the hook, this reset on every render and the
// typed-plate/repeat-scan re-seed would have silently no-opped — the exact 2026-07-21 bug the nonce
// was invented to fix. eslint's exhaustive-deps caught it, which is a nice argument for not
// suppressing that rule: it was complaining about a real defect, not about style.
let scanSeq = 0;
const nextScanNonce = () => ++scanSeq;

export function useScanPipeline(deps: {
  vehicles: Vehicle[];
  user: { id: string; name: string } | null | undefined;
  checkGeotab: (plate: string) => Promise<boolean>;
  backfillFromRead: (read: KeytagRead, photo: string) => void;
  recordOwningArea: (vehicleId: string, owningArea: string) => Promise<void>;
  recordClassCode: (vehicleId: string, classCode: string) => Promise<void>;
  recordVinLast9: (vehicleId: string, vin: string) => Promise<void>;
  setScanRead: (r: KeytagRead) => void;
  setScanNonce: (n: number) => void;
  setGeotabPending: (v: boolean) => void;
  setCodexToast: (s: string) => void;
  /** Holds a TYPED plate's sighting until an action earns it — see lib/sightings.actionImpliesPresence. */
  pendingSightingRef: { current: Parameters<typeof recordSighting>[0] | null };
}) {
  const {
    vehicles, user, checkGeotab, backfillFromRead,
    recordOwningArea, recordClassCode, recordVinLast9,
    setScanRead, setScanNonce, setGeotabPending, setCodexToast, pendingSightingRef,
  } = deps;

  return useCallback(async (read: KeytagRead, base64?: string) => {
    setScanRead(read);
    setScanNonce(nextScanNonce()); // distinct per scan → each "Start trip"/"Log L&F" re-seeds the destination

    // ── "Last seen" ── The scan IS the sighting: he's physically holding the car right now, which
    // is a thing nothing else in FG records (a trip means someone drove it, a hold means someone
    // flagged it). Logged HERE, at the read, rather than on an action — because most scans end in
    // "look and walk away", and those still mean he had the car in his hands. Resolve first so a
    // mis-read plate lands on the right car, and so a known vehicle's id rides along.
    // Fire-and-forget by contract: a bookkeeping failure must never cost him a scan.
    const seen = resolveKeytagScan(read, vehicles);
    // The plate the rest of this function should use. On a unit-number match the TAG had no
    // readable plate, but the car we resolved to does — and both `recordSighting` and the geotab
    // check guard on a non-empty plate, so passing the tag's blank would have made a unit-matched
    // scan silently skip its sighting AND its geotab lookup. Widening the resolver reached these.
    const effectivePlate = seen.plate || seen.vehicle?.licensePlate || '';
    const sighting = {
      plate: effectivePlate,
      vehicleId: seen.vehicle?.id ?? null,
      seenById: user?.id ?? null,
      seenByName: user?.name ?? null,
      branchId: seen.vehicle?.branchId ?? null,
    };
    // ⭐ A PHOTO IS THE PROOF. You cannot photograph a key tag you are not holding, so a scan's
    // sighting is earned the moment it is read. A TYPED plate proves nothing about where he is —
    // he could be at the desk — so it is HELD and only recorded if the action he picks next is an
    // act performed ON the car (Aaron: "typing something in just to look it up won't count as
    // seen"). See lib/sightings.actionImpliesPresence.
    if (base64) void recordSighting(sighting);
    else pendingSightingRef.current = sighting;

    setGeotabPending(await checkGeotab(effectivePlate));
    // An on-record car with blank fields gets them filled HERE, at the scan — so whichever action
    // he routes to below (hold / view / trip) already sees a complete record. Blanks-only. Passing
    // the photo also lets backfill attach the tag to a known car that lacks one (universal capture,
    // if-missing) — one choke-point instead of a separate attach call here.
    if (base64) void backfillFromRead(read, base64);
    // The owning branch — read off the tag's class line, discarded by this app until 2026-08-18.
    // If-missing and fire-and-forget: it accumulates as he scans, and a car's owning survives a
    // re-plate, so the first good read is the one that counts. See context/owningAreaWrite.
    if (read.owningArea && seen.vehicle && !seen.vehicle.owningArea) {
      void recordOwningArea(seen.vehicle.id, read.owningArea);
    }
    // The class code itself — same if-missing, fire-and-forget shape. FG resolved this code into a
    // make and model on every scan and then threw the code away, so a record's identity could never
    // be checked against what produced it. A car's code doesn't change, so the first good read wins
    // and a later misread can't rewrite it. See context/classCodeWrite.
    // Fires when there's no code OR when the stored one was only DERIVED (migration 121's backfill).
    // Skipping on any stored value would mean a deduction outranks a reading — see classCodeWrite.
    if (read.classCode && seen.vehicle
        && (!seen.vehicle.classCode || seen.vehicle.fieldSources?.classCode === 'derived')) {
      void recordClassCode(seen.vehicle.id, read.classCode);
    }
    // The last 9 of the VIN — printed on every printed tag, and read straight past for the whole
    // life of the scanner. Same if-missing, fire-and-forget shape, and the strictest version of the
    // rule: a VIN is immutable, so the first good read is the only one that will ever be taken.
    // It is the one key that survives Aaron's out-of-province → MB conversions, where the plate
    // (what FG searches by) changes and everything else stays. See context/vinWrite.
    if (read.vinLast9 && seen.vehicle && !seen.vehicle.vinLast9) {
      void recordVinLast9(seen.vehicle.id, read.vinLast9!);
    }
    // ── The codex's missing drain ── A class code the codex can't resolve is why registration
    // degrades. Two outcomes, and only one of them used to exist:
    //   • The car is ALREADY on record with a make/model → the record IS the answer. Teach the
    //     codex from it and say so. Until this, learning happened ONLY in the register form, so a
    //     known car could never resolve its code and re-logged the same complaint every scan
    //     (CTAC, a Tacoma, logged three times before anything could close it).
    //   • Genuinely unknown → log it, so codes self-report instead of waiting for someone to get
    //     stuck at a car and ask.
    // Fire-and-forget both ways: neither a lesson nor a log may cost him the scan.
    if (isUnknownClassCode(read)) {
      const lesson = classCodeLessonFromScan(read, seen.vehicle);
      if (lesson) {
        void teachClassCode(lesson.code, lesson.make, lesson.model, user?.id);
        setCodexToast(classCodeLearnedLabel(lesson));
      } else {
        void logUnknownClassCode(read.classCode ?? '', read.plate ?? '');
      }
    }
    // The setters and the ref are referentially stable (useState setters / useRef), so listing them
    // costs nothing and keeps the rule honest rather than suppressed.
  }, [vehicles, user, checkGeotab, backfillFromRead, recordOwningArea, recordClassCode, recordVinLast9,
      setScanRead, setScanNonce, setGeotabPending, setCodexToast, pendingSightingRef]);
}
