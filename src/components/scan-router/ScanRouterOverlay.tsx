// The universal scan-router overlay: snap a key tag → read → resolve against the fleet → show
// WHAT the car is + its state → offer only the actions that make sense → route to the module
// pre-filled. One shared flow behind both entry points (My Day card + header icon).
// Thin-hub law: this resolves and ROUTES — every action hands off to the module that owns it.
// The action menu itself is pure + tested (lib/scanRouterActions); this is just its surface.
import { useCallback, useEffect, useState } from 'react';
import { useKeytagRead } from '../../hooks/useKeytagRead';
import { useScanRouter } from '../../context/scanRouter';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { ScanReplateOffer } from './ScanReplateOffer';
import { compressImage } from '../../lib/image';
import { scanRouterActions } from '../../lib/scanRouterActions';
import { scanStatusLine, TONE_TEXT, TONE_BLOCK } from '../../lib/scanStatusLine';
import { ScanDamageZones } from './ScanDamageZones';
import { evAssetScanStatus } from '../../lib/ev-detection';
import { useGeotabPending } from '../../hooks/useGeotabPending';
import { useBackfillOnScan } from '../../hooks/useBackfillOnScan';
import { scanHoldLines, flaggedOnLabel } from '../../lib/scanHoldSummary';
import { useAuth } from '../../context/AuthContext';
import { matchedByUnitLabel, isPlateMismatch } from '../../lib/matchByUnitNumber';
import { ScanManualPlate } from './ScanManualPlate';
import { ScanVehicleCapture } from './ScanVehicleCapture';
import { ScanPlateWatch } from './ScanPlateWatch';
import { usePlateWatches } from '../../hooks/usePlateWatches';
import { watchFor } from '../../lib/plateWatch';
import { useScanPipeline } from '../../hooks/useScanPipeline';
import { resolveKeytagScan } from '../../lib/resolveKeytagScan';
import { isUnknownClassCode } from '../../lib/partialRegister';
import { commitPendingSighting } from '../../hooks/useVehicleSightings';
import { actionImpliesPresence } from '../../lib/sightings';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import type { Screen } from '../../types';

interface Props {
  navigate: (screen: Screen) => void;
  onClose: () => void;
}

// Monotonic across the whole app lifetime — NOT per-mount. The overlay unmounts on close, so a

export function ScanRouterOverlay({ navigate, onClose }: Props) {
  const { readKeytag, status, error, errorRef } = useKeytagRead();
  const { user } = useAuth();
  const { vehicles, holds, updateVehicleFields, attachKeytagPhotoIfMissing, recordKeyCount, recordOwningArea, recordClassCode, recordVinLast9, recordOdometer, clearOdometer, updateVehicleEVAssets, adoptPlate } = useVehicleHoldContext();
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
    const base64 = await compressImage(file);
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
    const plate = typed.trim().toUpperCase().replace(/\s+/g, '');
    if (!plate) return;
    resetScanState();
    setScanPhoto(null);   // no tag was photographed — nothing to attach, and a stale one would lie
    await applyRead({ plate });
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
  const holdLines = vehicle ? scanHoldLines(holds, vehicle.id) : [];
  // NOT "active" — holdLines is ACTIVE **or RELEASED** since 2026-08-17. The old name is what let
  // a released hold speak as though it were holding the car. Count only; never the label.
  const liveHolds = holdLines.length;
  // Computed AFTER holdLines: a held car gets a "Mark repaired" route at the top of the menu.
  const actions = scanRead && result ? scanRouterActions(scanRead, result, scanNonce, holdLines.length > 0) : [];
  // EV-kit status surfaced at scan (tag in hand) for Teslas with asset records — the charge cable +
  // adapter walk off easily, so "last seen missing the cable" the moment you scan = check it NOW.
  const evScan = vehicle ? evAssetScanStatus(vehicle) : null;

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Scan a key tag">
      <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">📷 Scan a key tag</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none cursor-pointer">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {!scanRead && (
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
          {/* Always offered, not just after a failure — see ScanManualPlate. */}
          <ScanManualPlate onSubmit={p => void onManualPlate(p)} busy={reading} />

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
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
                {result.wasCorrected && result.rawPlate && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Read <span className="font-mono">{result.rawPlate}</span> → corrected to <span className="font-mono font-semibold">{result.plate}</span>
                  </p>
                )}
                <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                  {/* ⭐ Once a vehicle RESOLVED, its record is authoritative for the plate — not the
                      tag read. Two reasons, and the second one is new:
                        • On a unit-number match the tag had no readable plate at all, and handing
                          the record's plate back is the entire point of that fallback.
                        • The reader now runs a cheap model first (api/keytag-read.ts), which is
                          ~87.5% on plates against ~97.5% on unit numbers. So a read can resolve
                          correctly VIA THE UNIT while carrying a misread plate — roughly 1 in 8.
                          Showing the read's plate there would print a plate the car doesn't have,
                          on a card he uses to identify the car in his hand.
                      An UNresolved read still shows what was read, because that's all there is. */}
                  {vehicle?.licensePlate || result.plate || ''}{vehicle?.unitNumber ? ` · Unit ${vehicle.unitNumber}` : ''}
                </p>
                {vehicle ? (
                  <>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}{vehicle.color ? ` · ${vehicle.color}` : ''}
                    </p>
                    {/* Derived from the vehicle's STATUS, never from the hold count — see
                        scanStatusLine.ts. The count only adds a suffix. */}
                    {(() => {
                      const line = scanStatusLine(vehicle.status, liveHolds);
                      return <p className={`text-xs font-semibold mt-0.5 ${TONE_TEXT[line.tone]}`}>{line.text}</p>;
                    })()}
                    {/* WHAT'S WRONG WITH IT — Aaron's ask (2026-08-16), the last gap in this card.
                        The overlay always had these holds in scope and counted them into "On hold
                        (2)", dropping the description: it said something's wrong, then made him
                        open the record to find out what. Now the tag tells him "Damage · Windshield
                        chip" while he's standing at the car, so he can verify it's still there or
                        already fixed without a detour. A hold the car went OUT on is called out
                        loudest — that's the old-damage amnesia FG exists to prevent. */}
                    {holdLines.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {holdLines.map(l => (
                          /* Tone follows the VEHICLE's status, not the hold's existence — an
                             on-exception hold still overrides to amber because that car is out
                             carrying the damage right now, which is the one thing worth shouting
                             about regardless of what the record says. */
                          <div key={l.id} className={`rounded-lg px-2 py-1.5 text-xs ${
                            l.onException
                              ? TONE_BLOCK.amber
                              : TONE_BLOCK[scanStatusLine(vehicle.status, liveHolds).tone]
                          }`}>
                            <p className="font-semibold">
                              {l.onException ? '⚠️ Out on exception' : '🔧'} {l.typeLabel}
                              <span className="font-normal opacity-70"> · flagged {flaggedOnLabel(l.flaggedAt)}</span>
                            </p>
                            {l.detail && <p className="mt-0.5">{l.detail}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* WHERE it is — the other half of the hold lines above, which say only WHAT.
                        Silent on a car with no panels recorded (most scans). See ScanDamageZones. */}
                    <ScanDamageZones holds={holds} vehicleId={vehicle.id} />

                    {/* Keys, EV kit and odometer — one beat, extracted together because they
                        are one beat: tag in hand, trunk open, dash lit. See ScanVehicleCapture. */}
                    <ScanVehicleCapture
                      vehicle={vehicle}
                      scanNonce={scanNonce}
                      rentalClass={(scanRead?.rentalClass ?? vehicle.rentalClass ?? '').trim()}
                      recordKeyCount={recordKeyCount}
                      recordOdometer={recordOdometer}
                      clearOdometer={clearOdometer}
                      updateVehicleEVAssets={updateVehicleEVAssets}
                    />
                  </>
                ) : result && result.unitCandidates.length > 0 ? (
                  /* Two live cars carry the scanned unit and the plate was unreadable, so nothing
                     was matched. Deliberately NOT a guess and NOT a failure — name the candidates
                     and let him pick, because attaching a scan to the wrong car is the one outcome
                     worse than not resolving. (Three such pairs exist in the fleet today.) */
                  <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                    <p className="font-semibold">
                      ⚠️ {result.unitCandidates.length} cars carry unit #{result.unitCandidates[0].unitNumber} — and the plate wasn’t readable.
                    </p>
                    {result.unitCandidates.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => go({ name: 'vehicle', vehicleId: v.id })}
                        className="block w-full text-left rounded-lg border border-amber-300 dark:border-amber-700 px-2 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition cursor-pointer"
                      >
                        <span className="font-mono font-semibold">{v.licensePlate}</span>
                        <span className="opacity-80"> · {v.year} {v.make} {v.model} · {v.color}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Not in the fleet{actions.some(a => a.kind === 'register') ? '' : ' — couldn’t read enough to register it'}
                  </p>
                )}
                {/* Which key did the work. FG never resolves by the weaker key silently — if the
                    plate was unreadable and the unit number found the car, say so. */}
                {result?.matchedByUnit && (
                  /* Amber when the plate CHANGED (a re-plate needs a decision), blue when the tag
                     was simply unreadable (an FYI). Same lane rule as everywhere: status vs info. */
                  <p className={`text-xs font-semibold mt-1 ${
                    isPlateMismatch(result.plate, vehicle?.licensePlate)
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-blue-700 dark:text-blue-400'
                  }`}>
                    🔎 {matchedByUnitLabel(true, scanRead?.unitNumber, result.plate, vehicle?.licensePlate)}
                  </p>
                )}
                {/* ⭐ The unit fallback already RESOLVED the car; this is the one case where the
                    difference between the tag's plate and the record's is a real-world event rather
                    than a bad read. Renders itself away unless it classifies as a re-plate. */}
                {vehicle && (
                  <ScanReplateOffer
                    vehicle={vehicle}
                    tagPlate={result?.plate}
                    scanNonce={scanNonce}
                    adoptPlate={adoptPlate}
                  />
                )}
                {/* EV kit (Tesla) — last-seen status of the charge cable + J1772 adapter, surfaced at
                    the car so a missing one gets caught the moment the tag is read, not at dispatch. */}
                {evScan && (
                  evScan.kind === 'complete' ? (
                    <p className="text-xs font-semibold mt-1 text-green-700 dark:text-green-400">⚡ EV kit — last seen complete (cable + adapter)</p>
                  ) : (
                    <p className="text-xs font-semibold mt-1 text-amber-700 dark:text-amber-400">
                      ⚡ EV kit — last seen missing: {evScan.missing.map(m => (m === 'cable' ? 'charge cable' : 'J1772 adapter')).join(' + ')}
                    </p>
                  )
                )}
                {/* Geotab install watchlist — separate axis from holds/exception; must hold until installed. */}
                {geotabPending && (
                  <p className="text-xs font-semibold mt-1 text-amber-700 dark:text-amber-400">📡 On the Geotab install list — hold until a unit is installed</p>
                )}
                {/* Never fill silently — name exactly what the tag just landed on the record. */}
                {backfillToast && (
                  <p className="text-xs font-semibold mt-1 text-green-700 dark:text-green-400">{backfillToast}</p>
                )}
                {/* ...and never DISAGREE silently either. The tag in his hand is the best evidence
                    FG gets; a record that contradicts it is worth a line, not a shrug. */}
                {conflictToast && (
                  <p className="text-xs font-semibold mt-1 text-amber-700 dark:text-amber-400">{conflictToast}</p>
                )}
                {/* FG closed its own gap off this car's record — green, because nothing is owed. */}
                {codexToast && (
                  <p className="text-[11px] font-semibold mt-1 text-green-700 dark:text-green-400">{codexToast}</p>
                )}
                {/* Say WHY registration degraded. Before this the scan just quietly offered less
                    and the operator had to infer the cause from the shape of the failure.
                    Suppressed when the scan TAUGHT the code instead — asking him to add by hand
                    what FG just learned by itself is the exact confusion this pair replaced. */}
                {scanRead && isUnknownClassCode(scanRead) && !codexToast && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                    Class code <span className="font-mono font-semibold">{scanRead.classCode}</span> isn’t in the codex yet —
                    make/model need adding by hand. Logged for DiZee.
                  </p>
                )}
              </div>

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
              <button
                type="button"
                onClick={() => { setScanRead(null); setErrMsg(''); scan(); }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                Scan another
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
