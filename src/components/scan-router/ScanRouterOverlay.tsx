// The universal scan-router overlay: snap a key tag → read → resolve against the fleet → show
// WHAT the car is + its state → offer only the actions that make sense → route to the module
// pre-filled. One shared flow behind both entry points (My Day card + header icon).
// Thin-hub law: this resolves and ROUTES — every action hands off to the module that owns it.
// The action menu itself is pure + tested (lib/scanRouterActions); this is just its surface.
import { useCallback, useEffect, useState } from 'react';
import { useKeytagRead } from '../../hooks/useKeytagRead';
import { useScanRouter, type ScanMode } from '../../context/scanRouter';
import { ScanIdentityCard } from './ScanIdentityCard';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { compressImage } from '../../lib/image';
import { scanRouterActions } from '../../lib/scanRouterActions';
import { useGeotabPending } from '../../hooks/useGeotabPending';
import { useBackfillOnScan } from '../../hooks/useBackfillOnScan';
import { scanHoldLines } from '../../lib/scanHoldSummary';
import { consolidateDamage } from '../../lib/consolidateDamage';
import { useAuth } from '../../context/AuthContext';
import { VehicleLookup } from '../shared/VehicleLookup';
import { ScanPlateWatch } from './ScanPlateWatch';
import { usePlateWatches } from '../../hooks/usePlateWatches';
import { watchFor } from '../../lib/plateWatch';
import { useScanPipeline } from '../../hooks/useScanPipeline';
import { resolveKeytagScan } from '../../lib/resolveKeytagScan';
import { commitPendingSighting } from '../../hooks/useVehicleSightings';
import { actionImpliesPresence } from '../../lib/sightings';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import type { Screen } from '../../types';

interface Props {
  navigate: (screen: Screen) => void;
  /** Which door opened the sheet: 📷 fires the camera, 🔍 opens it typing (2026-09-10). Everything
   *  after the pick is identical — same card, same menu, same sighting rule. */
  mode: ScanMode;
  onClose: () => void;
}

export function ScanRouterOverlay({ navigate, mode, onClose }: Props) {
  const { readKeytag, status, error, errorRef } = useKeytagRead();
  const { user } = useAuth();
  const { vehicles, holds, updateVehicleFields, attachKeytagPhotoIfMissing, recordOwningArea, recordClassCode, recordVinLast9 } = useVehicleHoldContext();
  const checkGeotab = useGeotabPending();
  const { backfillToast, conflictToast, backfillFromRead } = useBackfillOnScan({ vehicles, updateVehicleFields, attachKeytagPhotoIfMissing });
  const { scan, pickedFileRef, pickedNonce } = useScanRouter();
  const { watches, clearWatch } = usePlateWatches();
  const [clearingWatch, setClearingWatch] = useState(false);
  const [scanRead, setScanRead] = useState<KeytagRead | null>(null);
  const [scanNonce, setScanNonce] = useState(0);
  // The compressed key-tag photo, kept so a REGISTER (new vehicle) can attach it to the freshly
  // created record — the known-vehicle attach below can't, the car doesn't exist yet at scan time.
  const [scanPhoto, setScanPhoto] = useState<string | null>(null);
  const [geotabPending, setGeotabPending] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  // Set when the scan taught the codex a code off this car's own record (see classCodeLesson).
  const [codexToast, setCodexToast] = useState('');
  const reading = status === 'reading';

  // Wrapped rather than suppressed: this is the consume-effect's only caller, so an identity
  // that changed every render would re-enter that effect on every render of a busy overlay.
  // ⭐ ONE PIPELINE, TWO ENTRY POINTS. Everything that happens once we have a KeytagRead — resolve,
  const applyRead = useScanPipeline({
    vehicles, user, checkGeotab, backfillFromRead,
    recordOwningArea, recordClassCode, recordVinLast9,
    setScanRead, setScanNonce, setGeotabPending, setCodexToast,
  });

  const resetScanState = () => { setErrMsg(''); setScanRead(null); setGeotabPending(false); setCodexToast(''); };

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    resetScanState();
    let base64: string;
    try {
      base64 = await compressImage(file);
    } catch {
      // The photo never decoded — say so on the surface he is already looking at rather than
      // leaving the sheet blank. Before this, compressImage could not fail at all: an unreadable
      // file simply never settled and the overlay waited forever.
      setErrMsg('That photo could not be read — try the shot again.');
      return;
    }
    setScanPhoto(base64);
    const read = await readKeytag(base64);
    // Bail only when the tag gave us NEITHER identity key. It used to bail on a missing plate
    // alone — so a crumpled tag whose "Veh #" was perfectly legible reported "Could not read that
    // key tag", about a car FG had on record. The scan hadn't failed; the check had.
    if (!read?.plate && !read?.unitNumber?.trim()) {
      setErrMsg(errorRef.current ?? error ?? 'Could not read that key tag — try again.');
      return;
    }
    await applyRead(read, base64);
  }, [readKeytag, errorRef, error, applyRead]);

  // ⭐ THE FALLBACK. Aaron, 2026-08-25 — after my backfill drained the API credits and left him at a
  // car with a dead scanner: *"how bout a fall back to enter plate if the scanner goes down too and
  // it would count it as being seen."*
  //
  // The airport flip has had this since July ("or type a plate — if the scan's down"); the HEADER
  // scanner, the surface he reaches for most, had no way out at all. Vision down meant dead end.
  //
  // ⭐ AND IT COUNTS AS A SIGHTING, which is the sharp part of his ask. A sighting is not evidence
  // that the CAMERA worked — it is evidence that HE WAS AT THE CAR. Typing the plate makes exactly
  // the same claim as reading the tag: same person, same car, same moment. `recordSighting` has no
  // source field for precisely that reason, so this is honest rather than a shortcut.
  //
  // A bare plate is a legitimate KeytagRead with one field. Everything downstream already degrades
  // correctly: `resolveKeytagScan` matches it, `newVehicleFromRead` returns null (too partial to
  // mint a car), and `canRegisterPartially` offers "Register — add make/model". Degrade, never
  // dead-end.
  const onManualPlate = useCallback(async (typed: string) => {
    // ⚠️ NOT `correctManitobaPlate`. That corrector is a safety net UNDER A VISION READ — its own
    // header says so. These characters were typed by Aaron with his thumbs; they are not a misread,
    // they are what he meant. Silently re-prefixing them showed him a plate he never entered with no
    // way to see why: typing `DFJK947` searched for `LFJK947`, because `DFJ` is one character from
    // `LFJ` (2026-08-27). `plateWatch` had already written the principle down for its own surface —
    // *"a watch must never silently rewrite a plate into a different car's"* — and it applies here
    // with more force, because here the plate came from HIM.
    //
    // A fuzzy LOOKUP downstream is welcome and does good work (his own screenshot shows `DFJK947`
    // finding `DFKJ947` through a transposition). Searching flexibly is help; rewriting the input
    // before searching is not.
    const raw = typed.trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) return;
    resetScanState();
    setScanPhoto(null);   // no tag was photographed — nothing to attach, and a stale one would lie
    // ⭐⭐ AN ALL-DIGIT ENTRY IS A UNIT NUMBER, NOT A PLATE — and `resolveKeytagScan` has matched on
    // the unit since it was written (`matchByUnitNumber`, reporting `matchedByUnit`). It simply
    // never got one from here: this path always built `{ plate }`, so the fallback had nothing to
    // fall back to. **The capability was starved by the shape of the input, not missing.**
    //
    // Aaron, 2026-09-04: *"plate may be unreadable but you can still look up the unit right? how
    // does the header scanner work. just plate only?"* — it was, and this is the whole fix.
    const digits = raw.replace(/\D/g, '');
    await applyRead(digits.length === raw.length && digits.length >= 5
      ? { unitNumber: digits }
      : { plate: raw });
  }, [applyRead]);

  // A header/My Day tap fires the camera at app scope and opens this overlay in the same gesture,
  // so the photo arrives AFTER mount rather than from a button in here. Keyed on the nonce, not on
  // the File, and the ref is nulled before the read: re-running this effect must never re-read a
  // tag, which costs a real API call and writes a duplicate sighting. Cancelling the camera simply
  // leaves the "Snap the key tag" prompt below as the fallback.
  useEffect(() => {
    const file = pickedFileRef.current;
    if (!file) return;
    pickedFileRef.current = null;
    void onFile(file);
    // onFile is listed honestly rather than suppressed: nulling the ref BEFORE the read is what
    // makes one photo read once, so a re-run (vehicles churn) just early-returns.
  }, [pickedNonce, onFile, pickedFileRef]);

  // Resolved against the LIVE fleet each render rather than snapshotted at scan time: the backfill
  // above writes through context, so re-resolving is what makes the card show the now-filled
  // identity instead of the blanks the tag was read against.
  const result = scanRead ? resolveKeytagScan(scanRead, vehicles) : null;

  const vehicle = result?.vehicle ?? null;
  // ⭐ ONE LINE PER DEFECT, not per hold. Aaron, standing at a repeatedly-held car: *"i had one on
  // my last shift that gave me a wall of like 4 of the same damage."* The repeats are deliberate —
  // each hold/release pair records a real cycle, because one long hold would claim the car was off
  // the road the whole time — so the merge keeps the CYCLE COUNT and the FIRST date rather than
  // hiding them. See consolidateDamage.
  const holdLines = vehicle ? consolidateDamage(scanHoldLines(holds, vehicle.id)) : [];
  // Computed AFTER holdLines: a held car gets a "Mark repaired" route at the top of the menu.
  const actions = scanRead && result ? scanRouterActions(scanRead, result, scanNonce, holdLines.length > 0) : [];

  // Set only by the typed-plate path, and consumed at most once — by an action that implies he was
  // actually at the car. Closing the overlay without acting simply drops it, which is the point.
  const go = (screen: Screen, kind?: string) => {
    // ⭐ `view` no longer DROPS the held sighting — it leaves it held. Aaron's rule ("typing
    // something in just to look it up won't count as seen") is about *looking*, not about the route
    // he took to get there: viewing the record and then reading the odometer off the dash is an act
    // of presence, it just happens one screen later. The writes redeem it — see commitSightingFor.
    if (kind && actionImpliesPresence(kind)) commitPendingSighting();
    navigate(screen);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={mode === 'search' ? 'Find a car' : 'Scan a key tag'}>
      <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* ⭐ STICKY TOP: title, ✕ and the lookup. Aaron, 2026-09-10: on a damaged car he scrolls down
            to the damage map to copy it onto the paper inspection sheet, and the controls scrolled
            away with it, so every next step started with scrolling back. The card scrolls; the
            things he acts WITH stay put. (The scan button does the same at the bottom.) z-10 so
            the lookup's suggestion list opens over the card, not under it. */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{mode === 'search' ? '🔍 Find a car' : '📷 Scan a key tag'}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none cursor-pointer">✕</button>
        </div>
          <div className="px-4 pb-3">
            {/* Always offered, not just after a failure — see VehicleLookup.
                ⭐ Suggestions here on his call (2026-09-04): the overlay was the last surface still
                typing blind, and the field he reaches for when the tag will not read is exactly where
                being shown the car is worth most. Picking one hands over its PLATE, so the resolver
                below runs its normal path. */}
            <VehicleLookup onPick={c => void onManualPlate('vehicle' in c ? c.vehicle.license_plate : c.typed)}
              busy={reading}
              autoFocus={mode === 'search'}
              placeholder={mode === 'search' ? 'Plate or unit' : undefined} />
          </div>
        </div>

        {/* empty:hidden — opened from 🔍 with nothing looked up yet, every child below renders
            nothing, and the bare padding showed as a blank strip under the sticky lookup. */}
        <div className="p-4 space-y-3 empty:hidden">
          {/* The snap prompt is the CAMERA door's cold state. Opened from 🔍 there is no tag in hand
              by definition, so the sheet leads with the typing instead. */}
          {!scanRead && mode === 'camera' && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">Snap the tag — FG will tell you what the car is and what you can do with it.</p>
              <button
                type="button"
                disabled={reading}
                onClick={scan}
                className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 px-4 py-4 text-black font-semibold text-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {reading ? 'Reading…' : '📷 Snap the key tag'}
              </button>
            </>
          )}

          {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}

          {/* ✋ THE AMBUSH — leads the sheet, and renders WITH OR WITHOUT A RESOLVED VEHICLE.
              Both halves matter. Leading, because a watch is the one thing that changes what he
              does with the car in his hand, and reading it under the status line is reading it too
              late. Vehicle-independently, because the car this exists FOR is the one FG has never
              seen — on an unresolved read the rest of this sheet has nothing to say and would walk
              him straight to "register it". ⚠️ Matched on the READ plate, not the record's, since
              a watched stranger car has no record to take a plate from. */}
          {(() => {
            const hit = result && watchFor(result.plate, watches);
            return hit ? (
              <ScanPlateWatch
                watch={hit}
                clearing={clearingWatch}
                onClear={() => {
                  setClearingWatch(true);
                  void clearWatch(hit.id).finally(() => setClearingWatch(false));
                }}
              />
            ) : null;
          })()}

          {result && (
            <>
              {/* What the car IS + its state — resolve first, so the menu below is smart. */}
              <ScanIdentityCard
                scanRead={scanRead}
                result={result}
                holdLines={holdLines}
                scanNonce={scanNonce}
                canRegister={actions.some(a => a.kind === 'register')}
                onPickCandidate={id => go({ name: 'vehicle', vehicleId: id })}
                geotabPending={geotabPending}
                backfillToast={backfillToast}
                conflictToast={conflictToast}
                codexToast={codexToast}
              />

              <div className="space-y-1.5">
                {actions.map(a => (
                  <button
                    key={a.kind}
                    type="button"
                    onClick={() => go(
                      a.screen.name === 'register-vehicle' && scanPhoto
                        ? { ...a.screen, scannedPhoto: scanPhoto }
                        : a.screen,
                      a.kind,
                    )}
                    className="w-full flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-left"
                  >
                    <span className="text-base leading-none">{a.icon}</span>
                    <span className="flex-1">{a.label}</span>
                    <span className="text-gray-300 dark:text-gray-600">→</span>
                  </button>
                ))}
              </div>

              {/* Scan another → open the camera in ONE tap, not two. Resetting scanRead alone
                  would land back on the cold "Snap the tag" intro, forcing a second tap on the
                  snap button. scan() fires the provider's always-mounted input from inside this
                  user gesture, so the camera opens straight away. */}
              {/* STICKY BOTTOM — the other half of the sticky top: the next scan stays one tap away
                  however far down the card he has scrolled. -mx/-mb cancel the content padding so
                  the bar sits flush with the sheet's edges. */}
              <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => { setScanRead(null); setErrMsg(''); scan(); }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                {mode === 'search' ? '📷 Scan a tag' : 'Scan another'}
              </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
