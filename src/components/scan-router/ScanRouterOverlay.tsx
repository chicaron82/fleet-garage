// The universal scan-router overlay: snap a key tag → read → resolve against the fleet → show
// WHAT the car is + its state → offer only the actions that make sense → route to the module
// pre-filled. One shared flow behind both entry points (My Day card + header icon).
// Thin-hub law: this resolves and ROUTES — every action hands off to the module that owns it.
// The action menu itself is pure + tested (lib/scanRouterActions); this is just its surface.
import { useRef, useState } from 'react';
import { useKeytagRead } from '../../hooks/useKeytagRead';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { compressImage } from '../../lib/image';
import { resolveKeytagScan } from '../../lib/resolveKeytagScan';
import { scanRouterActions } from '../../lib/scanRouterActions';
import { isOnExceptionStatus } from '../../lib/vehicle-status';
import { evAssetScanStatus } from '../../lib/ev-detection';
import { useGeotabPending } from '../../hooks/useGeotabPending';
import { useBackfillOnScan } from '../../hooks/useBackfillOnScan';
import { recordSighting } from '../../hooks/useVehicleSightings';
import { scanHoldLines, flaggedOnLabel } from '../../lib/scanHoldSummary';
import { useAuth } from '../../context/AuthContext';
import { logUnknownClassCode, teachClassCode } from '../../hooks/useUnknownClassCode';
import { isUnknownClassCode } from '../../lib/partialRegister';
import { classCodeLessonFromScan, classCodeLearnedLabel } from '../../lib/classCodeLesson';
import { matchedByUnitLabel } from '../../lib/matchByUnitNumber';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import type { Screen } from '../../types';

interface Props {
  navigate: (screen: Screen) => void;
  onClose: () => void;
}

// Monotonic across the whole app lifetime — NOT per-mount. The overlay unmounts on close, so a
// per-mount counter would restart at the same value each open and two separate scans of the same
// tag would collide (re-introducing the no-op re-seed). Module scope guarantees every scan, in any
// open, gets a distinct nonce.
let scanSeq = 0;

export function ScanRouterOverlay({ navigate, onClose }: Props) {
  const { readKeytag, status, error } = useKeytagRead();
  const { user } = useAuth();
  const { vehicles, holds, updateVehicleFields, attachKeytagPhotoIfMissing, recordKeyCount } = useVehicleHoldContext();
  const checkGeotab = useGeotabPending();
  const { backfillToast, conflictToast, backfillFromRead } = useBackfillOnScan({ vehicles, updateVehicleFields, attachKeytagPhotoIfMissing });
  const fileRef = useRef<HTMLInputElement>(null);
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

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setErrMsg('');
    setScanRead(null);
    setGeotabPending(false);
    setCodexToast('');
    const base64 = await compressImage(file);
    setScanPhoto(base64);
    const read = await readKeytag(base64);
    // Bail only when the tag gave us NEITHER identity key. It used to bail on a missing plate
    // alone — so a crumpled tag whose "Veh #" was perfectly legible reported "Could not read that
    // key tag", about a car FG had on record. The scan hadn't failed; the check had.
    if (!read?.plate && !read?.unitNumber?.trim()) {
      setErrMsg(error ?? 'Could not read that key tag — try again.');
      return;
    }
    setScanRead(read);
    setScanNonce(++scanSeq); // distinct per scan → each "Start trip"/"Log L&F" re-seeds the destination

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
    void recordSighting({
      plate: effectivePlate,
      vehicleId: seen.vehicle?.id ?? null,
      seenById: user?.id ?? null,
      seenByName: user?.name ?? null,
      branchId: seen.vehicle?.branchId ?? null,
    });

    setGeotabPending(await checkGeotab(effectivePlate));
    // An on-record car with blank fields gets them filled HERE, at the scan — so whichever action
    // he routes to below (hold / view / trip) already sees a complete record. Blanks-only. Passing
    // the photo also lets backfill attach the tag to a known car that lacks one (universal capture,
    // if-missing) — one choke-point instead of a separate attach call here.
    void backfillFromRead(read, base64);
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
  };

  // Resolved against the LIVE fleet each render rather than snapshotted at scan time: the backfill
  // above writes through context, so re-resolving is what makes the card show the now-filled
  // identity instead of the blanks the tag was read against.
  const result = scanRead ? resolveKeytagScan(scanRead, vehicles) : null;

  const vehicle = result?.vehicle ?? null;
  const holdLines = vehicle ? scanHoldLines(holds, vehicle.id) : [];
  const activeHolds = holdLines.length;
  // Computed AFTER holdLines: a held car gets a "Mark repaired" route at the top of the menu.
  const actions = scanRead && result ? scanRouterActions(scanRead, result, scanNonce, holdLines.length > 0) : [];
  // EV-kit status surfaced at scan (tag in hand) for Teslas with asset records — the charge cable +
  // adapter walk off easily, so "last seen missing the cable" the moment you scan = check it NOW.
  const evScan = vehicle ? evAssetScanStatus(vehicle) : null;

  const go = (screen: Screen) => { navigate(screen); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Scan a key tag">
      <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">📷 Scan a key tag</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none cursor-pointer">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }}
          />

          {!scanRead && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">Snap the tag — FG will tell you what the car is and what you can do with it.</p>
              <button
                type="button"
                disabled={reading}
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 px-4 py-4 text-black font-semibold text-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {reading ? 'Reading…' : '📷 Snap the key tag'}
              </button>
            </>
          )}

          {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}

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
                  {/* On a unit-number match the TAG had no plate — but the car we resolved to does,
                      and handing that plate back is the entire point of the fallback. Falling back
                      to the record's plate keeps the header from opening with a bare "· Unit …". */}
                  {result.plate || vehicle?.licensePlate || ''}{vehicle?.unitNumber ? ` · Unit ${vehicle.unitNumber}` : ''}
                </p>
                {vehicle ? (
                  <>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}{vehicle.color ? ` · ${vehicle.color}` : ''}
                    </p>
                    <p className={`text-xs font-semibold mt-0.5 ${
                      isOnExceptionStatus(vehicle.status) ? 'text-amber-700 dark:text-amber-400'
                      : activeHolds > 0 ? 'text-red-600 dark:text-red-400'
                      : 'text-green-700 dark:text-green-400'
                    }`}>
                      {isOnExceptionStatus(vehicle.status) ? '⚠️ On exception'
                        : activeHolds > 0 ? `🔧 On hold (${activeHolds})`
                        : '✅ Clear'}
                    </p>
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
                          <div key={l.id} className={`rounded-lg px-2 py-1.5 text-xs ${
                            l.onException
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'
                              : 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300'
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

                    {/* Key count surfaced HERE, tag in hand — not hidden behind opening the unit. If
                        it's unlogged, log the baseline right now (the moment of truth), so a future
                        short return is detectable. (ticket-scan-keycount-surface.) */}
                    {vehicle.keyCount != null ? (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">🔑 {vehicle.keyCount} key{vehicle.keyCount === 1 ? '' : 's'} on the ring</p>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">🔑 Keys not logged —</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map(n => (
                            <button key={n} type="button" onClick={() => void recordKeyCount(vehicle.id, n)}
                              className="w-6 h-6 rounded text-xs font-semibold border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer">
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : result && result.unitCandidates.length > 0 ? (
                  /* Two live cars carry the scanned unit and the plate was unreadable, so nothing
                     was matched. Deliberately NOT a guess and NOT a failure — name the candidates
                     and let him pick, because attaching a scan to the wrong car is the one outcome
                     worse than not resolving. (Three such pairs exist in the fleet today.) */
                  <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                    <p className="font-semibold">
                      ⚠️ Two cars carry unit #{result.unitCandidates[0].unitNumber} — and the plate wasn’t readable.
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
                  <p className="text-xs font-semibold mt-1 text-blue-700 dark:text-blue-400">
                    🔎 {matchedByUnitLabel(true, scanRead?.unitNumber)}
                  </p>
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
                  snap button. The file input is always mounted and this onClick is a user
                  gesture, so firing it directly opens the camera straight away. */}
              <button
                type="button"
                onClick={() => { setScanRead(null); setErrMsg(''); fileRef.current?.click(); }}
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
