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
import { useGeotabPending } from '../../hooks/useGeotabPending';
import { useBackfillOnScan } from '../../hooks/useBackfillOnScan';
import { logUnknownClassCode } from '../../hooks/useUnknownClassCode';
import { isUnknownClassCode } from '../../lib/partialRegister';
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
  const { vehicles, holds, updateVehicleFields, attachKeytagPhotoIfMissing, recordKeyCount } = useVehicleHoldContext();
  const checkGeotab = useGeotabPending();
  const { backfillToast, conflictToast, backfillFromRead } = useBackfillOnScan({ vehicles, updateVehicleFields });
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanRead, setScanRead] = useState<KeytagRead | null>(null);
  const [scanNonce, setScanNonce] = useState(0);
  // The compressed key-tag photo, kept so a REGISTER (new vehicle) can attach it to the freshly
  // created record — the known-vehicle attach below can't, the car doesn't exist yet at scan time.
  const [scanPhoto, setScanPhoto] = useState<string | null>(null);
  const [geotabPending, setGeotabPending] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const reading = status === 'reading';

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setErrMsg('');
    setScanRead(null);
    setGeotabPending(false);
    const base64 = await compressImage(file);
    setScanPhoto(base64);
    const read = await readKeytag(base64);
    if (!read?.plate) { setErrMsg(error ?? 'Could not read that key tag — try again.'); return; }
    setScanRead(read);
    setScanNonce(++scanSeq); // distinct per scan → each "Start trip"/"Log L&F" re-seeds the destination

    setGeotabPending(await checkGeotab(read.plate));
    // An on-record car with blank fields gets them filled HERE, at the scan — so whichever action
    // he routes to below (hold / view / trip) already sees a complete record. Blanks-only.
    void backfillFromRead(read);
    // Keep the tag on the record it resolved to — the evidence a misread is audited against.
    const known = resolveKeytagScan(read, vehicles).vehicle;
    if (known) void attachKeytagPhotoIfMissing(known.id, base64);
    // A class code the codex can't resolve is why registration degrades — record it so codes
    // self-report instead of waiting for someone to get stuck at a car and ask.
    if (isUnknownClassCode(read)) void logUnknownClassCode(read.classCode ?? '', read.plate ?? '');
  };

  // Resolved against the LIVE fleet each render rather than snapshotted at scan time: the backfill
  // above writes through context, so re-resolving is what makes the card show the now-filled
  // identity instead of the blanks the tag was read against.
  const result = scanRead ? resolveKeytagScan(scanRead, vehicles) : null;
  const actions = scanRead && result ? scanRouterActions(scanRead, result, scanNonce) : [];
  const vehicle = result?.vehicle ?? null;
  const activeHolds = vehicle ? holds.filter(h => h.vehicleId === vehicle.id && h.status === 'ACTIVE').length : 0;

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
                  {result.plate}{vehicle?.unitNumber ? ` · Unit ${vehicle.unitNumber}` : ''}
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
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Not in the fleet{actions.some(a => a.kind === 'register') ? '' : ' — couldn’t read enough to register it'}
                  </p>
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
                {/* Say WHY registration degraded. Before this the scan just quietly offered less
                    and the operator had to infer the cause from the shape of the failure. */}
                {scanRead && isUnknownClassCode(scanRead) && (
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

              <button
                type="button"
                onClick={() => { setScanRead(null); setErrMsg(''); }}
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
